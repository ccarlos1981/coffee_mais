import 'dart:convert';
import 'dart:io';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/providers/visita_detail_provider.dart';
import '../../core/providers/agenda_provider.dart';
import '../../core/services/sync_queue_service.dart';
import '../../core/services/location_service.dart';
import '../../core/services/supabase_service.dart';
import '../../core/services/log_service.dart';
import '../../core/services/api_client.dart';
import 'ai_shelf_capture_page.dart';

class VisitaDetailPage extends ConsumerStatefulWidget {
  final String visitaId;

  const VisitaDetailPage({super.key, required this.visitaId});

  @override
  ConsumerState<VisitaDetailPage> createState() => _VisitaDetailPageState();
}

class _VisitaDetailPageState extends ConsumerState<VisitaDetailPage> {
  final _locationService = LocationService();
  bool _btnLoading = false;
  Position? _currentPos;
  double? _distanceToPdv;
  bool _isMockGps = false;
  Map<String, dynamic>? _aiAnalysisResult;
  bool _loadingAiAnalysis = false;
  Map<String, dynamic>? _selloutResult;
  bool _loadingSellout = false;
  String? _selloutError;

  Map<String, dynamic>? _orderRecResult;
  bool _loadingOrderRec = false;
  String? _orderRecError;

  List<dynamic> _aiRecommendations = [];
  bool _loadingRecommendations = false;
  String? _recommendationsError;
  bool _fetchedRecommendations = false;

  @override
  void initState() {
    super.initState();
    _checkLocation();
    _fetchAiAnalysis();
  }

  Future<void> _checkLocation() async {
    try {
      final pos = await _locationService.getCurrentPosition();
      setState(() {
        _currentPos = pos;
        _isMockGps = _locationService.isMockLocation(pos);
      });
      _calculateDistance();
    } catch (e) {
      print('Error obtaining location in details: $e');
    }
  }

  void _calculateDistance() {
    final detailState = ref.read(visitaDetailProvider(widget.visitaId));
    if (_currentPos != null && detailState.geoloc != null) {
      final latLoja = detailState.geoloc!['latitude'] as double?;
      final lonLoja = detailState.geoloc!['longitude'] as double?;
      if (latLoja != null && lonLoja != null) {
        final dist = Geolocator.distanceBetween(
          _currentPos!.latitude,
          _currentPos!.longitude,
          latLoja,
          lonLoja,
        );
        setState(() {
          _distanceToPdv = dist;
        });
      }
    }
  }

  // --- Core Operations ---

  Future<void> _iniciarDeslocamento() async {
    setState(() {
      _btnLoading = true;
    });

    try {
      final supabase = SupabaseService().client;
      // Direct supabase update for in-route event (which can sync offline in SDK cache)
      await supabase
          .from('cm_promotor_visita')
          .update({
            'status': 'EM_ROTA',
            'em_rota_at': DateTime.now().toIso8601String(),
          })
          .eq('id', widget.visitaId);

      ref.read(visitaDetailProvider(widget.visitaId).notifier).updateLocalStatus('EM_ROTA');
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Rota iniciada. Deslocando-se para o PDV.')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro ao iniciar deslocamento: $e'), backgroundColor: Colors.redAccent),
      );
    } finally {
      setState(() {
        _btnLoading = false;
      });
    }
  }

  Future<void> _checkin() async {
    await _checkLocation();
    
    if (_isMockGps) {
      LogService().log(
        eventType: 'GPS_MOCK_DETECTED',
        severity: 'CRITICAL',
        payload: {
          'visita_id': widget.visitaId,
          'latitude': _currentPos?.latitude,
          'longitude': _currentPos?.longitude,
        },
      );
      _showErrorDialog('GPS Falso detectado! Por favor, desative aplicativos de localização simulada.');
      return;
    }

    final detailState = ref.read(visitaDetailProvider(widget.visitaId));
    final limitRadius = detailState.geoloc?['geofence_radius_m'] as double? ?? 100.0;

    if (_distanceToPdv != null && _distanceToPdv! > limitRadius) {
      _showErrorDialog('Você está fora da cerca virtual permitida para esta loja. Distância: ${_distanceToPdv!.toStringAsFixed(0)}m. O limite é ${limitRadius.toStringAsFixed(0)}m.');
      return;
    }

    // Capture Fachada Photo
    final photoPath = await _capturePhoto();
    if (photoPath == null) return;

    setState(() {
      _btnLoading = true;
    });

    try {
      final checkinData = {
        'visita_id': widget.visitaId,
        'latitude': _currentPos?.latitude ?? 0.0,
        'longitude': _currentPos?.longitude ?? 0.0,
        'dispositivo_timestamp': DateTime.now().toIso8601String(),
        'foto_fachada_path': photoPath,
      };

      final actionId = await ref.read(syncQueueProvider.notifier).queueAction('checkin', checkinData);
      await ref.read(syncQueueProvider.notifier).queuePhoto(
            actionId,
            photoPath,
            widget.visitaId,
            'FACHADA',
          );

      ref.read(visitaDetailProvider(widget.visitaId).notifier).updateLocalStatus('CHECKIN_REALIZADO');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Check-in realizado! Ação salva na fila.')),
      );
    } catch (e) {
      _showErrorDialog('Erro ao realizar check-in: $e');
    } finally {
      setState(() {
        _btnLoading = false;
      });
    }
  }

  Future<void> _checkout() async {
    final detailState = ref.read(visitaDetailProvider(widget.visitaId));
    
    // Check if checklists completed
    final pendingMissions = detailState.missoes.where((m) => detailState.execucoes[m['missao_id']] == null).toList();
    if (pendingMissions.isNotEmpty) {
      _showErrorDialog('Você deve preencher todos os checklists de missões pendentes antes de realizar o Checkout.');
      return;
    }

    // Check photos constraints
    final motivo = detailState.visita?['motivo_visita'] as String? ?? 'rotina';
    bool hasRequiredPhoto = false;
    if (motivo == 'rotina' || motivo == 'abastecimento') {
      hasRequiredPhoto = detailState.fotos.any((f) => f['tipo_foto'] == 'GONDOLA');
      if (!hasRequiredPhoto) {
        _showErrorDialog('Para visitas de rotina ou abastecimento, é obrigatório registrar pelo menos uma foto de GÔNDOLA.');
        return;
      }
    } else if (motivo == 'ruptura') {
      hasRequiredPhoto = detailState.fotos.any((f) => f['tipo_foto'] == 'RUPTURA');
      if (!hasRequiredPhoto) {
        _showErrorDialog('Para visitas de auditoria de ruptura, é obrigatório registrar pelo menos uma foto de RUPTURA.');
        return;
      }
    }

    setState(() {
      _btnLoading = true;
    });

    try {
      final checkoutData = {
        'visita_id': widget.visitaId,
        'latitude': _currentPos?.latitude ?? 0.0,
        'longitude': _currentPos?.longitude ?? 0.0,
        'dispositivo_timestamp': DateTime.now().toIso8601String(),
      };

      await ref.read(syncQueueProvider.notifier).queueAction('checkout', checkoutData);

      ref.read(visitaDetailProvider(widget.visitaId).notifier).updateLocalStatus('CONCLUIDA');
      ref.read(agendaProvider.notifier).fetchAgenda(); // Trigger refresh on agenda
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checkout realizado! Visita finalizada.')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      _showErrorDialog('Erro ao realizar checkout: $e');
    } finally {
      setState(() {
        _btnLoading = false;
      });
    }
  }

  Future<void> _tirarFoto(String tipo) async {
    final photoPath = await _capturePhoto();
    if (photoPath == null) return;

    setState(() {
      _btnLoading = true;
    });

    try {
      final photoData = {
        'visita_id': widget.visitaId,
        'tipo_foto': tipo,
        'latitude': _currentPos?.latitude,
        'longitude': _currentPos?.longitude,
        'taken_at': DateTime.now().toIso8601String(),
        'foto_path': photoPath,
      };

      final actionId = await ref.read(syncQueueProvider.notifier).queueAction('upload_foto', photoData);
      await ref.read(syncQueueProvider.notifier).queuePhoto(
            actionId,
            photoPath,
            widget.visitaId,
            tipo,
          );

      // Add to local UI array immediately
      ref.read(visitaDetailProvider(widget.visitaId).notifier).loadDetails(widget.visitaId);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Foto de $tipo salva na fila de uploads.')),
      );
    } catch (e) {
      _showErrorDialog('Erro ao salvar foto: $e');
    } finally {
      setState(() {
        _btnLoading = false;
      });
    }
  }

  Future<void> _abrirChecklist(Map<String, dynamic> mission) async {
    final missaoId = mission['missao_id'] as String;
    final mInfo = mission['missao'] as Map;
    final titulo = mInfo['titulo'] as String? ?? 'Checklist';
    
    // Check if answers already exist
    final detailState = ref.read(visitaDetailProvider(widget.visitaId));
    final respostasExistentes = detailState.execucoes[missaoId] as Map? ?? {};
    
    final Map<String, dynamic> checklistAnswers = Map.from(respostasExistentes);

    // Prompt standard trade questions
    final List<Map<String, String>> perguntas = [
      {'id': 'p_mix', 'label': 'Mix de produtos completo nas gôndolas?'},
      {'id': 'p_prec', 'label': 'Precificação visível e correta?'},
      {'id': 'p_ruptura', 'label': 'Detectou alguma ruptura grave?'},
      {'id': 'p_limpeza', 'label': 'Gôndolas limpas e organizadas?'},
    ];

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E130C),
              title: Text(titulo, style: const TextStyle(color: Color(0xFFF3E5D8))),
              content: SizedBox(
                width: double.maxFinite,
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: perguntas.length,
                  itemBuilder: (context, index) {
                    final item = perguntas[index];
                    final pId = item['id']!;
                    final label = item['label']!;
                    final valor = checklistAnswers[pId] ?? 'sim';

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(label, style: const TextStyle(color: Colors.white, fontSize: 14)),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              ChoiceChip(
                                label: const Text('Sim'),
                                selected: valor == 'sim',
                                onSelected: (val) {
                                  setDialogState(() {
                                    checklistAnswers[pId] = 'sim';
                                  });
                                },
                              ),
                              const SizedBox(width: 8),
                              ChoiceChip(
                                label: const Text('Não'),
                                selected: valor == 'nao',
                                onSelected: (val) {
                                  setDialogState(() {
                                    checklistAnswers[pId] = 'nao';
                                  });
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('CANCELAR', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: () async {
                    // Queue checklist save
                    final dataPayload = {
                      'visita_id': widget.visitaId,
                      'missao_id': missaoId,
                      'respostas_checklist': checklistAnswers,
                    };
                    await ref.read(syncQueueProvider.notifier).queueAction('missao', dataPayload);
                    ref.read(visitaDetailProvider(widget.visitaId).notifier).updateLocalExecucao(missaoId, checklistAnswers);
                    
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Checklist salvo e enfileirado.')),
                    );
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD4A373)),
                  child: const Text('SALVAR', style: TextStyle(color: Colors.black)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _abrirOcorrencia() async {
    String tipoOcorrencia = 'LOJA_FECHADA';
    final descController = TextEditingController();
    File? fotoOcorrencia;

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E130C),
              title: const Text('Registrar Ocorrência', style: TextStyle(color: Color(0xFFF3E5D8))),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Selecione o motivo do impedimento:', style: TextStyle(color: Colors.grey, fontSize: 13)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      dropdownColor: const Color(0xFF1E130C),
                      initialValue: tipoOcorrencia,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.white30)),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'LOJA_FECHADA', child: Text('Loja Fechada')),
                        DropdownMenuItem(value: 'ACESSO_NEGADO', child: Text('Acesso Negado')),
                        DropdownMenuItem(value: 'SEM_ESTOQUE', child: Text('Sem Estoque do Produto')),
                        DropdownMenuItem(value: 'OUTRO', child: Text('Outro Ocorrido')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            tipoOcorrencia = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: descController,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        labelText: 'Descrição / Justificativa',
                        labelStyle: TextStyle(color: Colors.grey),
                        enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.white30)),
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    if (fotoOcorrencia != null) ...[
                      Image.file(fotoOcorrencia!, height: 120, fit: BoxFit.cover),
                      const SizedBox(height: 8),
                    ],
                    ElevatedButton.icon(
                      onPressed: () async {
                        final path = await _capturePhoto();
                        if (path != null) {
                          setDialogState(() {
                            fotoOcorrencia = File(path);
                          });
                        }
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.white.withOpacity(0.08)),
                      icon: const Icon(Icons.camera_alt_outlined),
                      label: Text(fotoOcorrencia != null ? 'SUBSTITUIR FOTO' : 'ANEXAR FOTO COMPROVANTE'),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('CANCELAR', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: () async {
                    if (fotoOcorrencia == null && (tipoOcorrencia == 'LOJA_FECHADA' || tipoOcorrencia == 'ACESSO_NEGADO')) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Foto comprovante é obrigatória para este tipo de ocorrência.')),
                      );
                      return;
                    }

                    final dataPayload = {
                      'visita_id': widget.visitaId,
                      'tipo_ocorrencia': tipoOcorrencia,
                      'descricao': descController.text,
                      'foto_path': fotoOcorrencia?.path,
                    };

                    final actionId = await ref.read(syncQueueProvider.notifier).queueAction('ocorrencia', dataPayload);
                    if (fotoOcorrencia != null) {
                      await ref.read(syncQueueProvider.notifier).queuePhoto(
                            actionId,
                            fotoOcorrencia!.path,
                            widget.visitaId,
                            'OCORRENCIA',
                          );
                    }

                    // Impeditivo finaliza a visita
                    String finalStatus = 'PLANEJADA';
                    if (tipoOcorrencia == 'LOJA_FECHADA') {
                      finalStatus = 'LOJA_FECHADA';
                    } else if (tipoOcorrencia == 'ACESSO_NEGADO') {
                      finalStatus = 'NAO_REALIZADA';
                    }

                    ref.read(visitaDetailProvider(widget.visitaId).notifier).updateLocalStatus(finalStatus);
                    ref.read(agendaProvider.notifier).fetchAgenda();
                    
                    Navigator.pop(context);
                    Navigator.pop(context); // Voltar pro dashboard
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Ocorrência impeditiva enfileirada. Visita encerrada.')),
                    );
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                  child: const Text('ENVIAR', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // --- Call Mock Camera ---

  Future<String?> _capturePhoto() async {
    final directory = Directory.systemTemp;
    final mockFile = File('${directory.path}/visita_capture_${DateTime.now().millisecondsSinceEpoch}.jpg');
    // Generates dummy image bytes ~300KB
    await mockFile.writeAsBytes(List.generate(300 * 1024, (i) => i % 256));
    return mockFile.path;
  }

  void _showErrorDialog(String msg) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E130C),
        title: const Text('Validação por Compliance', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
        content: Text(msg, style: const TextStyle(color: Colors.white)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK', style: TextStyle(color: Color(0xFFD4A373))),
          ),
        ],
      ),
    );
  }

  Future<void> _fetchAiAnalysis() async {
    if (!mounted) return;
    setState(() {
      _loadingAiAnalysis = true;
    });
    try {
      final response = await ApiClient().get('/api/ai/shelf-analysis/${widget.visitaId}');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true && mounted) {
          setState(() {
            _aiAnalysisResult = data;
          });
        }
      }
    } catch (e) {
      print('Error fetching AI analysis: $e');
    } finally {
      if (mounted) {
        setState(() {
          _loadingAiAnalysis = false;
        });
      }
    }
  }

  Future<void> _fetchSelloutData(String codParceiro) async {
    if (!mounted) return;
    setState(() {
      _loadingSellout = true;
      _selloutError = null;
    });
    try {
      final response = await ApiClient().get('/api/promotor/pdv/$codParceiro/sellout');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true && mounted) {
          setState(() {
            _selloutResult = data;
          });
        } else {
          setState(() {
            _selloutError = data['error'] ?? 'Erro desconhecido';
          });
        }
      } else {
        setState(() {
          _selloutError = 'Status ${response.statusCode}';
        });
      }
    } catch (e) {
      setState(() {
        _selloutError = e.toString();
      });
      print('Error fetching sell-out analysis: $e');
    } finally {
      if (mounted) {
        setState(() {
          _loadingSellout = false;
        });
      }
    }
  }

  Future<void> _fetchOrderRecommendation(String codParceiro, String visitaId) async {
    if (!mounted) return;
    setState(() {
      _loadingOrderRec = true;
      _orderRecError = null;
    });
    try {
      final response = await ApiClient().get('/api/promotor/pdv/$codParceiro/order-recommendation?visita_id=$visitaId');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true && mounted) {
          setState(() {
            _orderRecResult = data['recommendation'];
          });
        } else {
          setState(() {
            _orderRecError = data['error'] ?? 'Erro ao obter recomendação';
          });
        }
      } else {
        setState(() {
          _orderRecError = 'Status ${response.statusCode}';
        });
      }
    } catch (e) {
      setState(() {
        _orderRecError = e.toString();
      });
      print('Error fetching order recommendation: $e');
    } finally {
      if (mounted) {
        setState(() {
          _loadingOrderRec = false;
        });
      }
    }
  }

  Future<void> _fetchAIRecommendations(String codParceiro) async {
    if (!mounted) return;
    setState(() {
      _loadingRecommendations = true;
      _recommendationsError = null;
    });
    try {
      final response = await ApiClient().get('/api/promotor/recommendations?pdv_id=$codParceiro&status=OPEN');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true && mounted) {
          setState(() {
            _aiRecommendations = data['recommendations'] ?? [];
          });
        } else {
          setState(() {
            _recommendationsError = data['error'] ?? 'Erro ao obter recomendações';
          });
        }
      } else {
        setState(() {
          _recommendationsError = 'Status ${response.statusCode}';
        });
      }
    } catch (e) {
      setState(() {
        _recommendationsError = e.toString();
      });
      print('Error fetching AI recommendations: $e');
    } finally {
      if (mounted) {
        setState(() {
          _loadingRecommendations = false;
        });
      }
    }
  }

  Future<void> _submitRecommendationFeedback(String recommendationId, String status, {String notes = "", int rating = 5}) async {
    try {
      final response = await ApiClient().post(
        '/api/promotor/recommendations',
        jsonEncode({
          'recommendation_id': recommendationId,
          'status': status,
          'feedback_notes': notes,
          'feedback_rating': rating,
        }),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          if (mounted) {
            setState(() {
              _aiRecommendations.removeWhere((item) => item['id'] == recommendationId);
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(status == 'EXECUTED' ? 'Ação executada com sucesso!' : 'Recomendação descartada.'),
                backgroundColor: status == 'EXECUTED' ? Colors.green : Colors.grey,
              ),
            );
          }
        }
      }
    } catch (e) {
      print('Error submitting recommendation feedback: $e');
    }
  }

  Widget _buildSelloutStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 9)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Future<void> _tirarFotoIa() async {
    final photoPath = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (context) => const AiShelfCapturePage()),
    );

    if (photoPath == null) return;

    setState(() {
      _btnLoading = true;
    });

    try {
      final pos = await _locationService.getCurrentPosition();
      
      final shelfData = {
        'visita_id': widget.visitaId,
        'foto_path': photoPath,
        'width': 1920,
        'height': 1080,
        'captured_at': DateTime.now().toIso8601String(),
        'camera_metadata': {
          'gps_accuracy': pos.accuracy,
          'latitude': pos.latitude,
          'longitude': pos.longitude,
          'altitude': pos.altitude,
        },
      };

      final actionId = await ref.read(syncQueueProvider.notifier).queueAction(
        'shelf_ia',
        shelfData,
      );

      await ref.read(syncQueueProvider.notifier).queuePhoto(
        actionId,
        photoPath,
        widget.visitaId,
        'SHELF_IA',
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Foto de gôndola enviada para análise IA offline-first!'),
          backgroundColor: Colors.green,
        ),
      );

      // Refresh after a brief delay to simulate local synchronization
      Future.delayed(const Duration(seconds: 4), () {
        _fetchAiAnalysis();
      });

    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao enviar foto para IA: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      setState(() {
        _btnLoading = false;
      });
    }
  }

  // --- Rendering UI Sections ---

  Widget _buildVisitHeader(Map<String, dynamic> visit) {
    final pdv = visit['pdv'] as Map? ?? {};
    final status = visit['status'] as String? ?? 'PLANEJADA';
    final motivo = visit['motivo_visita'] as String? ?? 'rotina';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF23170F),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  pdv['nome_fantasia'] as String? ?? 'Nome PDV',
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ),
              _buildBadge(status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            pdv['razao_social'] as String? ?? '',
            style: const TextStyle(color: Colors.grey, fontSize: 13),
          ),
          const Divider(height: 24, color: Colors.white10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildMetaTile('Motivo', motivo.toUpperCase()),
              _buildMetaTile('Criticidade', (visit['criticidade_visita'] as String? ?? 'NORMAL')),
              _buildMetaTile('Estimativa', '${visit['duracao_estimada_min'] ?? 60} min'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetaTile(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(color: Color(0xFFD4A373), fontSize: 13, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildBadge(String status) {
    Color color = Colors.grey;
    if (status == 'CHECKIN_REALIZADO') {
      color = Colors.amber;
    } else if (status == 'EM_EXECUCAO') color = Colors.amber[700]!;
    else if (status == 'CONCLUIDA') color = Colors.greenAccent;
    else if (status == 'LOJA_FECHADA' || status == 'NAO_REALIZADA') color = Colors.redAccent;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final detailState = ref.watch(visitaDetailProvider(widget.visitaId));

    if (detailState.status == VisitaDetailStatus.loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation(Color(0xFFD4A373)))),
      );
    }

    if (detailState.status == VisitaDetailStatus.error || detailState.visita == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: Text('Erro ao carregar visita: ${detailState.errorMessage}')),
      );
    }

    final visit = detailState.visita!;
    final status = visit['status'] as String? ?? 'PLANEJADA';

    if (detailState.visita != null && _selloutResult == null && !_loadingSellout && _selloutError == null) {
      final pdv = detailState.visita!['pdv'] as Map? ?? {};
      final codParceiro = pdv['cod_parceiro'] as String?;
      if (codParceiro != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _fetchSelloutData(codParceiro);
        });
      }
    }

    if (detailState.visita != null && _orderRecResult == null && !_loadingOrderRec && _orderRecError == null) {
      final pdv = detailState.visita!['pdv'] as Map? ?? {};
      final codParceiro = pdv['cod_parceiro'] as String?;
      if (codParceiro != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _fetchOrderRecommendation(codParceiro, widget.visitaId);
        });
      }
    }

    if (detailState.visita != null && !_fetchedRecommendations && !_loadingRecommendations && _recommendationsError == null) {
      final pdv = detailState.visita!['pdv'] as Map? ?? {};
      final codParceiro = pdv['cod_parceiro'] as String?;
      if (codParceiro != null) {
        _fetchedRecommendations = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _fetchAIRecommendations(codParceiro);
        });
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Execução de Visita'),
        backgroundColor: const Color(0xFF1E130C),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(visitaDetailProvider(widget.visitaId).notifier).loadDetails(widget.visitaId),
          )
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1E130C), Color(0xFF18100A)],
          ),
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildVisitHeader(visit),
              const SizedBox(height: 16),
              _buildCommercialInfoButton(context, visit),
              const SizedBox(height: 20),

              // Status and workflow actions
              if (status == 'PLANEJADA') ...[
                ElevatedButton.icon(
                  onPressed: _btnLoading ? null : _iniciarDeslocamento,
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD4A373), padding: const EdgeInsets.symmetric(vertical: 14)),
                  icon: const Icon(Icons.directions_car_filled_outlined, color: Colors.black),
                  label: const Text('INICIAR DESLOCAMENTO', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                ),
              ],

              if (status == 'EM_ROTA') ...[
                ElevatedButton.icon(
                  onPressed: _btnLoading ? null : _checkin,
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD4A373), padding: const EdgeInsets.symmetric(vertical: 14)),
                  icon: const Icon(Icons.camera_front_outlined, color: Colors.black),
                  label: const Text('INICIAR VISITA (CHECK-IN FACHADA)', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _btnLoading ? null : _abrirOcorrencia,
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.redAccent, side: const BorderSide(color: Colors.redAccent), padding: const EdgeInsets.symmetric(vertical: 14)),
                  icon: const Icon(Icons.warning_amber_rounded),
                  label: const Text('LOJA FECHADA / IMPEDIDO'),
                ),
              ],

              if (status == 'CHECKIN_REALIZADO' || status == 'EM_EXECUCAO') ...[
                // Checklist section
                Card(
                  color: Colors.white.withOpacity(0.03),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.white.withOpacity(0.08))),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Checklists de Missões', style: TextStyle(color: Color(0xFFF3E5D8), fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: 12),
                        if (detailState.missoes.isEmpty)
                          const Text('Nenhuma missão vinculada para este PDV hoje.', style: TextStyle(color: Colors.grey, fontSize: 13))
                        else
                          ...detailState.missoes.map((m) {
                            final mId = m['missao_id'] as String;
                            final isDone = detailState.execucoes[mId] != null;
                            final title = (m['missao'] as Map)['titulo'] as String? ?? 'Missão';

                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14)),
                              trailing: Icon(
                                isDone ? Icons.check_circle : Icons.radio_button_unchecked,
                                color: isDone ? Colors.greenAccent : Colors.grey,
                              ),
                              onTap: () => _abrirChecklist(m),
                            );
                          }),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Photos Album section
                Card(
                  color: Colors.white.withOpacity(0.03),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.white.withOpacity(0.08))),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Álbum de Fotos', style: TextStyle(color: Color(0xFFF3E5D8), fontWeight: FontWeight.bold, fontSize: 16)),
                            PopupMenuButton<String>(
                              icon: const Icon(Icons.add_a_photo_outlined, color: Color(0xFFD4A373)),
                              onSelected: _tirarFoto,
                              itemBuilder: (context) => const [
                                PopupMenuItem(value: 'GONDOLA', child: Text('Foto Gôndola')),
                                PopupMenuItem(value: 'RUPTURA', child: Text('Foto Ruptura')),
                                PopupMenuItem(value: 'EXTRA', child: Text('Foto Ponto Extra')),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (detailState.fotos.isEmpty)
                          const Text('Nenhuma foto enviada para esta visita.', style: TextStyle(color: Colors.grey, fontSize: 13))
                        else
                          GridView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: detailState.fotos.length,
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 3,
                              crossAxisSpacing: 8,
                              mainAxisSpacing: 8,
                            ),
                            itemBuilder: (context, index) {
                              final f = detailState.fotos[index];
                              return ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  color: Colors.white10,
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      const Icon(Icons.image, color: Colors.white24, size: 28),
                                      Positioned(
                                        bottom: 4,
                                        left: 4,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                          decoration: BoxDecoration(color: Colors.black.withOpacity(0.8), borderRadius: BorderRadius.circular(4)),
                                          child: Text(
                                            f['tipo_foto'] as String? ?? '',
                                            style: const TextStyle(color: Colors.amber, fontSize: 8, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // AI Shelf Recognition Section
                Card(
                  color: Colors.white.withOpacity(0.03),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: Colors.white.withOpacity(0.08)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.auto_awesome, color: Color(0xFFD4A373), size: 18),
                                SizedBox(width: 8),
                                Text(
                                  'Auditoria de Gôndola IA',
                                  style: TextStyle(
                                    color: Color(0xFFF3E5D8),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                  ),
                                ),
                              ],
                            ),
                            if (_loadingAiAnalysis)
                              const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation(Color(0xFFD4A373)),
                                ),
                              )
                            else
                              IconButton(
                                icon: const Icon(Icons.refresh, size: 16, color: Colors.grey),
                                onPressed: _fetchAiAnalysis,
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (_aiAnalysisResult == null)
                          const Text(
                            'Nenhuma foto de prateleira analisada para esta visita ainda.',
                            style: TextStyle(color: Colors.grey, fontSize: 12),
                          )
                        else ...[
                          // Display simulated AI results
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Status Ruptura: ${_aiAnalysisResult!['rupture_status']}',
                                style: TextStyle(
                                  color: _aiAnalysisResult!['rupture_status'] == 'OK'
                                      ? Colors.greenAccent
                                      : _aiAnalysisResult!['rupture_status'] == 'PARCIAL'
                                          ? Colors.amberAccent
                                          : Colors.redAccent,
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                'Score: ${_aiAnalysisResult!['planogram_score']}/100',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Facings Coffee Mais: ${_aiAnalysisResult!['coffee_mais_facings']} | Confiança: ${((double.tryParse(_aiAnalysisResult!['ai_confidence'].toString()) ?? 0.0) * 100).toStringAsFixed(1)}%',
                            style: const TextStyle(color: Colors.grey, fontSize: 11),
                          ),
                          if (_aiAnalysisResult!['price_analysis'] != null) ...[
                            const SizedBox(height: 12),
                            const Divider(color: Colors.white24, height: 1),
                            const SizedBox(height: 12),
                            const Text(
                              'PRICE INTELLIGENCE',
                              style: TextStyle(color: Color(0xFFD4A373), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1),
                            ),
                            const SizedBox(height: 8),
                             Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Preço Coffee Mais', style: TextStyle(color: Colors.grey, fontSize: 10)),
                                    const SizedBox(height: 2),
                                    Text(
                                      'R\$ ${double.tryParse((_aiAnalysisResult!['price_analysis']['detected_prices'] as List).firstWhere((p) => p['brand'] == 'Coffee Mais', orElse: () => {'price': 0.0})['price'].toString())?.toStringAsFixed(2) ?? '0.00'}',
                                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                    ),
                                  ],
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Concorrente Próximo', style: TextStyle(color: Colors.grey, fontSize: 10)),
                                    const SizedBox(height: 2),
                                    Text(
                                      'R\$ ${double.tryParse((_aiAnalysisResult!['price_analysis']['detected_prices'] as List).firstWhere((p) => p['brand'] != 'Coffee Mais', orElse: () => {'price': 0.0})['price'].toString())?.toStringAsFixed(2) ?? '0.00'}',
                                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                    ),
                                  ],
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    const Text('Price Gap', style: TextStyle(color: Colors.grey, fontSize: 10)),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${(double.tryParse(_aiAnalysisResult!['price_analysis']['price_gap_percent'].toString()) ?? 0.0) >= 0 ? '+' : ''}${double.tryParse(_aiAnalysisResult!['price_analysis']['price_gap_percent'].toString())?.toStringAsFixed(1) ?? '0.0'}%',
                                      style: TextStyle(
                                        color: (double.tryParse(_aiAnalysisResult!['price_analysis']['price_gap_percent'].toString()) ?? 0.0) > 15
                                            ? Colors.redAccent
                                            : (double.tryParse(_aiAnalysisResult!['price_analysis']['price_gap_percent'].toString()) ?? 0.0) > 5
                                                ? Colors.amberAccent
                                                : Colors.greenAccent,
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Risco: ${_aiAnalysisResult!['price_analysis']['pricing_risk']}',
                                  style: TextStyle(
                                    color: _aiAnalysisResult!['price_analysis']['pricing_risk'] == 'OVERPRICED'
                                        ? Colors.redAccent
                                        : _aiAnalysisResult!['price_analysis']['pricing_risk'] == 'SLIGHTLY_EXPENSIVE'
                                            ? Colors.amberAccent
                                            : _aiAnalysisResult!['price_analysis']['pricing_risk'] == 'UNDERPRICED'
                                                ? Colors.blueAccent
                                                : Colors.greenAccent,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  'Oportunidade: ${_aiAnalysisResult!['price_analysis']['price_opportunity_score']}',
                                  style: const TextStyle(color: Colors.grey, fontSize: 11),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 12),
                        ],
                        const SizedBox(height: 8),
                        ElevatedButton.icon(
                          onPressed: _btnLoading ? null : _tirarFotoIa,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFD4A373),
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          icon: const Icon(Icons.photo_camera_outlined, size: 18),
                          label: const Text(
                            'FOTO GÔNDOLA IA',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Sell-Out Intelligence Section
                Card(
                  color: Colors.white.withOpacity(0.03),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: Colors.white.withOpacity(0.08)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.inventory_2_outlined, color: Color(0xFFD4A373), size: 18),
                                SizedBox(width: 8),
                                Text(
                                  'Sell-Out Intelligence',
                                  style: TextStyle(
                                    color: Color(0xFFF3E5D8),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                  ),
                                ),
                              ],
                            ),
                            if (_loadingSellout)
                              const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation(Color(0xFFD4A373)),
                                ),
                              )
                            else if (detailState.visita != null)
                              IconButton(
                                icon: const Icon(Icons.refresh, size: 16, color: Colors.grey),
                                onPressed: () {
                                  final pdv = detailState.visita!['pdv'] as Map? ?? {};
                                  final codParceiro = pdv['cod_parceiro'] as String?;
                                  if (codParceiro != null) {
                                    _fetchSelloutData(codParceiro);
                                  }
                                },
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (_selloutResult == null)
                          Text(
                            _selloutError ?? 'Nenhum dado de sell-out analisado para esta visita ainda.',
                            style: const TextStyle(color: Colors.grey, fontSize: 12),
                          )
                        else ...[
                          ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: (_selloutResult!['sku_analysis'] as List).length,
                            itemBuilder: (context, idx) {
                              final item = _selloutResult!['sku_analysis'][idx] as Map;
                              final skuName = (item['sku'] as String? ?? '').replaceAll('COFFEE_MAIS_', '').replaceAll('_', ' ');
                              final stock = item['estimated_stock_boxes'] as num? ?? 0.0;
                              final velocity = item['sellout_velocity'] as num? ?? 0.0;
                              final days = item['days_of_inventory'] as num? ?? 0.0;
                              final risk = item['stock_risk'] as String? ?? 'LOW';
                              final suggested = item['suggested_order_boxes'] as num? ?? 0.0;

                              Color riskColor = Colors.greenAccent;
                              if (risk == 'CRITICAL') {
                                riskColor = Colors.redAccent;
                              } else if (risk == 'HIGH') {
                                riskColor = Colors.orangeAccent;
                              } else if (risk == 'MEDIUM') {
                                riskColor = Colors.amberAccent;
                              }

                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.02),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.white.withOpacity(0.04)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          skuName,
                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: riskColor.withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(color: riskColor.withOpacity(0.3)),
                                          ),
                                          child: Text(
                                            risk,
                                            style: TextStyle(color: riskColor, fontSize: 9, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        _buildSelloutStat('Estoque', '${stock.toStringAsFixed(1)} cx'),
                                        _buildSelloutStat('Giro', '${velocity.toStringAsFixed(1)} cx/dia'),
                                        _buildSelloutStat('Cobertura', days >= 999 ? '∞' : '${days.toStringAsFixed(1)} dias'),
                                        _buildSelloutStat('Sugestão', '${suggested.toStringAsFixed(0)} cx'),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Order Recommendation Section
                _buildOrderRecommendationCard(context, visit),
                const SizedBox(height: 24),

                // Prescriptive AI Recommendations Section
                _buildPrescriptiveAiCard(context, visit),
                const SizedBox(height: 24),

                // Checkout button
                ElevatedButton.icon(
                  onPressed: _btnLoading ? null : _checkout,
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green[800], padding: const EdgeInsets.symmetric(vertical: 14)),
                  icon: const Icon(Icons.check_circle_outline, color: Colors.white),
                  label: const Text('FINALIZAR VISITA (CHECKOUT)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],

              if (status == 'CONCLUIDA') ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: Colors.green.withOpacity(0.08), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.green.withOpacity(0.3))),
                  child: const Row(
                    children: [
                      Icon(Icons.check_circle, color: Colors.greenAccent),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Esta visita foi finalizada com sucesso.',
                          style: TextStyle(color: Colors.greenAccent, fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCommercialInfoButton(BuildContext context, Map<String, dynamic> visit) {
    final pdv = visit['pdv'] as Map? ?? {};
    final codParceiro = pdv['cod_parceiro'] as String?;
    
    if (codParceiro == null) return const SizedBox.shrink();
    
    return InkWell(
      onTap: () => _showCommercialInfoBottomSheet(context, codParceiro),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              const Color(0xFFD4A373).withOpacity(0.15),
              const Color(0xFFD4A373).withOpacity(0.05),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFD4A373).withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFD4A373).withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.info_outline_rounded,
                color: Color(0xFFD4A373),
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Informações Comerciais',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Histórico, Sugestão de Pedido & Insights',
                    style: TextStyle(
                      color: Colors.grey,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Colors.grey,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  void _showCommercialInfoBottomSheet(BuildContext context, String codParceiro) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withOpacity(0.6),
      builder: (context) => _CommercialInfoBottomSheet(codParceiro: codParceiro),
    );
  }

  Widget _buildOrderRecommendationCard(BuildContext context, Map<String, dynamic> visit) {
    return Card(
      color: Colors.white.withOpacity(0.03),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.white.withOpacity(0.08)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.auto_awesome_outlined, color: Color(0xFFD4A373), size: 18),
                    SizedBox(width: 8),
                    Text(
                      'Pedido Sugerido IA',
                      style: TextStyle(
                        color: Color(0xFFF3E5D8),
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
                if (_loadingOrderRec)
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(Color(0xFFD4A373)),
                    ),
                  )
                else
                  IconButton(
                    icon: const Icon(Icons.refresh, size: 16, color: Colors.grey),
                    onPressed: () {
                      final pdv = visit['pdv'] as Map? ?? {};
                      final codParceiro = pdv['cod_parceiro'] as String?;
                      if (codParceiro != null) {
                        _fetchOrderRecommendation(codParceiro, widget.visitaId);
                      }
                    },
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (_orderRecError != null)
              Text(
                _orderRecError!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              )
            else if (_orderRecResult == null)
              const Text(
                'Nenhuma sugestão de pedido disponível.',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              )
            else if ((_orderRecResult!['items'] as List).isEmpty)
              const Text(
                'Nenhuma recomendação de compra para os produtos cadastrados.',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              )
            else ...[
              // Card Details
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'VALOR POTENCIAL',
                        style: TextStyle(color: Colors.grey, fontSize: 9, letterSpacing: 0.5),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'R\$ ${(_orderRecResult!['total_recommended_value'] as num).toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: Color(0xFFD4A373),
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'CAIXAS TOTAIS',
                        style: TextStyle(color: Colors.grey, fontSize: 9, letterSpacing: 0.5),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${(_orderRecResult!['total_recommended_boxes'] as num).toStringAsFixed(0)} cx',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Text(
                        'Urgência: ',
                        style: TextStyle(color: Colors.grey, fontSize: 11),
                      ),
                      _buildUrgencyBadge(_orderRecResult!['urgency_level'] as String? ?? 'LOW'),
                    ],
                  ),
                  Text(
                    'Probabilidade: ${(_orderRecResult!['conversion_probability'] as num).toStringAsFixed(0)}%',
                    style: const TextStyle(
                      color: Colors.greenAccent,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(color: Colors.white12, height: 1),
              const SizedBox(height: 12),
              
              // Tabela por SKU
              const Text(
                'SKUS SUGERIDOS',
                style: TextStyle(color: Color(0xFFD4A373), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1),
              ),
              const SizedBox(height: 8),
              ...(_orderRecResult!['items'] as List).map((itemMap) {
                final item = itemMap as Map;
                final skuName = (item['sku'] as String? ?? '').replaceAll('COFFEE_MAIS_', '').replaceAll('_', ' ');
                final boxes = item['suggested_boxes'] as num? ?? 0;
                final subtotal = item['subtotal'] as num? ?? 0.0;
                final reasons = item['reason'] as List? ?? [];

                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.01),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white.withOpacity(0.04)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            skuName,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                          Text(
                            '$boxes cx (${(item['priority_score'] as num).toStringAsFixed(0)} pts)',
                            style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 11),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Wrap(
                              spacing: 4,
                              runSpacing: 4,
                              children: reasons.map((r) => Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.05),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  r.toString(),
                                  style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 8),
                                ),
                              )).toList(),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'R\$ ${subtotal.toStringAsFixed(2)}',
                            style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }),

              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _btnLoading ? null : () => _gerarPedido(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD4A373),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.shopping_cart_checkout, size: 18),
                label: const Text(
                  'GERAR PEDIDO',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPrescriptiveAiCard(BuildContext context, Map<String, dynamic> visit) {
    return Card(
      color: Colors.white.withOpacity(0.03),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.white.withOpacity(0.08)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.auto_awesome, color: Color(0xFFD4A373), size: 18),
                    SizedBox(width: 8),
                    Text(
                      'Ações Recomendadas (IA)',
                      style: TextStyle(
                        color: Color(0xFFF3E5D8),
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
                if (_loadingRecommendations)
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(Color(0xFFD4A373)),
                    ),
                  )
                else
                  IconButton(
                    icon: const Icon(Icons.refresh, size: 16, color: Colors.grey),
                    onPressed: () {
                      final pdv = visit['pdv'] as Map? ?? {};
                      final codParceiro = pdv['cod_parceiro'] as String?;
                      if (codParceiro != null) {
                        _fetchAIRecommendations(codParceiro);
                      }
                    },
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (_recommendationsError != null)
              Text(
                _recommendationsError!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              )
            else if (_aiRecommendations.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8.0),
                child: Text(
                  'Nenhuma ação de trade recomendada para este PDV no momento.',
                  style: TextStyle(color: Colors.grey, fontSize: 12, fontStyle: FontStyle.italic),
                ),
              )
            else
              ..._aiRecommendations.map((rec) {
                final String id = rec['id'] ?? '';
                final String type = rec['recommendation_type'] ?? '';
                final String urgency = rec['urgency_level'] ?? 'LOW';
                final double roi = (rec['estimated_roi'] as num? ?? 0.0).toDouble();
                final double confidence = (rec['recommendation_confidence'] as num? ?? 100.0).toDouble();
                final double revenueUplift = (rec['expected_revenue_uplift'] as num? ?? 0.0).toDouble();
                final double historicalAccuracy = (rec['historical_accuracy'] as num? ?? 100.0).toDouble();
                
                String typeName = type;
                if (type == 'PRICE_REDUCTION') {
                  typeName = 'Redução de Preço';
                } else if (type == 'PRICE_INCREASE') typeName = 'Aumento de Preço';
                else if (type == 'TRADE_PROMOTION') typeName = 'Promoção Comercial';
                else if (type == 'EXTRA_VISIT') typeName = 'Visita Extra';
                else if (type == 'DEGUSTATION') typeName = 'Ação de Degustação';
                else if (type == 'DISPLAY_EXPANSION') typeName = 'Expansão de Espaço';
                else if (type == 'STOCK_REPLENISHMENT') typeName = 'Abastecimento / Reposição';
                else if (type == 'DISTRIBUTOR_REPLENISHMENT') typeName = 'Abastecimento Distribuidor';
                else if (type == 'NEGOTIATE_SPACE') typeName = 'Negociação de Ponto Extra';

                final List<dynamic> reasoningList = rec['reasoning'] as List<dynamic>? ?? [];

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.02),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withOpacity(0.05)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              typeName,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                          Wrap(
                            spacing: 4,
                            children: [
                              if (rec['governance_badge'] != null)
                                _buildGovernanceBadge(rec['governance_badge'] as String?),
                              _buildUrgencyBadge(urgency),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ...reasoningList.map((reason) => Padding(
                        padding: const EdgeInsets.only(bottom: 4.0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('• ', style: TextStyle(color: Color(0xFFD4A373))),
                            Expanded(
                              child: Text(
                                reason.toString(),
                                style: const TextStyle(color: Colors.grey, fontSize: 11),
                              ),
                            ),
                          ],
                        ),
                      )),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('UPLIFT DE RECEITA', style: TextStyle(color: Colors.grey, fontSize: 8)),
                              const SizedBox(height: 2),
                              Text(
                                'R\$ ${revenueUplift.toStringAsFixed(2)}',
                                style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('ROI ESTIMADO', style: TextStyle(color: Colors.grey, fontSize: 8)),
                              const SizedBox(height: 2),
                              Text(
                                '${roi.toStringAsFixed(2)}x',
                                style: const TextStyle(color: Color(0xFFD4A373), fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Text('CONF. IA / ACURÁCIA', style: TextStyle(color: Colors.grey, fontSize: 8)),
                              const SizedBox(height: 2),
                              Text(
                                '${confidence.toStringAsFixed(0)}% / ${historicalAccuracy.toStringAsFixed(0)}%',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            style: TextButton.styleFrom(
                              foregroundColor: Colors.grey,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            ),
                            onPressed: () {
                              _showDismissDialog(context, id);
                            },
                            child: const Text('Dispensar', style: TextStyle(fontSize: 12)),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green[700],
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            onPressed: () {
                              _showExecutionDialog(context, id);
                            },
                            child: const Text(
                              'Executar',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  void _showDismissDialog(BuildContext context, String recommendationId) {
    final notesController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E130C),
          title: const Text('Dispensar Recomendação', style: TextStyle(color: Colors.white)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Por favor, justifique por que esta recomendação está sendo dispensada:',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notesController,
                maxLines: 3,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Justificativa...',
                  hintStyle: const TextStyle(color: Colors.grey),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.05),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red[800]),
              onPressed: () {
                Navigator.pop(ctx);
                _submitRecommendationFeedback(recommendationId, 'DISMISSED', notes: notesController.text);
              },
              child: const Text('Dispensar', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  void _showExecutionDialog(BuildContext context, String recommendationId) {
    final notesController = TextEditingController();
    int rating = 5;
    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E130C),
              title: const Text('Confirmar Execução', style: TextStyle(color: Colors.white)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Registre detalhes ou notas sobre a execução da ação no PDV:',
                    style: TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesController,
                    maxLines: 2,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Ex: Preço reduzido conforme combinado...',
                      hintStyle: const TextStyle(color: Colors.grey),
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.05),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Avalie a utilidade desta recomendação (1 a 5):',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(5, (index) {
                      final starVal = index + 1;
                      return IconButton(
                        icon: Icon(
                          starVal <= rating ? Icons.star : Icons.star_border,
                          color: const Color(0xFFD4A373),
                          size: 28,
                        ),
                        onPressed: () {
                          setStateDialog(() {
                            rating = starVal;
                          });
                        },
                      );
                    }),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green[800]),
                  onPressed: () {
                    Navigator.pop(ctx);
                    _submitRecommendationFeedback(
                      recommendationId, 
                      'EXECUTED', 
                      notes: notesController.text, 
                      rating: rating,
                    );
                  },
                  child: const Text('Confirmar', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          }
        );
      },
    );
  }

  Widget _buildUrgencyBadge(String level) {
    Color color = Colors.greenAccent;
    if (level == 'CRITICAL') {
      color = Colors.redAccent;
    } else if (level == 'HIGH') {
      color = Colors.orangeAccent;
    } else if (level == 'MEDIUM') {
      color = Colors.amberAccent;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        level,
        style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildGovernanceBadge(String? badge) {
    if (badge == null || badge.isEmpty) return const SizedBox.shrink();
    
    Color color = Colors.blueAccent;
    if (badge == 'Requires Approval') {
      color = Colors.orangeAccent;
    } else if (badge == 'Auto Approved') {
      color = Colors.greenAccent;
    } else if (badge == 'AI Executed') {
      color = Colors.purpleAccent;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        badge,
        style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.bold),
      ),
    );
  }

  void _gerarPedido(BuildContext context) {
    if (_orderRecResult == null) return;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E130C),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.white.withOpacity(0.08)),
        ),
        title: const Row(
          children: [
            Icon(Icons.check_circle_outline, color: Colors.greenAccent),
            SizedBox(width: 8),
            Text(
              'Sucesso!',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Pedido de sell-in integrado com sucesso ao ERP corporativo.',
              style: TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Text(
              'Volume Total: ${(_orderRecResult!['total_recommended_boxes'] as num).toStringAsFixed(0)} caixas',
              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              'Valor Total: R\$ ${(_orderRecResult!['total_recommended_value'] as num).toStringAsFixed(2)}',
              style: const TextStyle(color: Color(0xFFD4A373), fontSize: 14, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text(
              'FECHAR',
              style: TextStyle(color: Color(0xFFD4A373), fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}


class _CommercialInfoBottomSheet extends StatefulWidget {
  final String codParceiro;
  const _CommercialInfoBottomSheet({required this.codParceiro});

  @override
  State<_CommercialInfoBottomSheet> createState() => _CommercialInfoBottomSheetState();
}

class _CommercialInfoBottomSheetState extends State<_CommercialInfoBottomSheet> {
  int _activeTab = 0;
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final response = await ApiClient().get('/api/promotor/pdv/${widget.codParceiro}/commercial-history');
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true) {
          setState(() {
            _data = body['data'];
            _loading = false;
          });
          return;
        }
      }
      setState(() {
        _error = 'Erro ao carregar histórico comercial (${response.statusCode})';
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Erro de rede: $e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    
    return ClipRRect(
      borderRadius: const BorderRadius.only(
        topLeft: Radius.circular(28),
        topRight: Radius.circular(28),
      ),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          height: mediaQuery.size.height * 0.85,
          decoration: BoxDecoration(
            color: const Color(0xEE1E130C),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(28),
              topRight: Radius.circular(28),
            ),
            border: Border.all(color: Colors.white.withOpacity(0.08)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              if (_loading)
                const Expanded(
                  child: Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation(Color(0xFFD4A373)),
                    ),
                  ),
                )
              else if (_error != null)
                Expanded(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 48),
                          const SizedBox(height: 16),
                          Text(_error!, style: const TextStyle(color: Colors.white, fontSize: 14), textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: () {
                              setState(() {
                                _loading = true;
                                _error = null;
                              });
                              _loadData();
                            },
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD4A373)),
                            child: const Text('Tentar Novamente', style: TextStyle(color: Colors.black)),
                          )
                        ],
                      ),
                    ),
                  ),
                )
              else
                Expanded(
                  child: _buildContent(),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    final pdvName = _data?['pdv_name'] ?? 'PDV';
    final freq = _data?['frequencia_media_compra_dias'] ?? 30;
    final sellIn90 = _data?['sell_in_90_dias'] ?? 0.0;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.analytics_outlined, color: Color(0xFFD4A373), size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      pdvName,
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _buildHeaderChip(Icons.calendar_today_rounded, 'Frequência: $freq dias'),
                  const SizedBox(width: 8),
                  _buildHeaderChip(Icons.monetization_on_outlined, 'Sell-in 90d: R\$ ${sellIn90.toStringAsFixed(2)}'),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.04),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.06)),
            ),
            padding: const EdgeInsets.all(4),
            child: Row(
              children: [
                _buildTabButton(0, 'Resumo & Ações'),
                _buildTabButton(1, 'Último Pedido'),
                _buildTabButton(2, 'Giro & Insights'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _buildActiveTabContent(),
          ),
        ),
      ],
    );
  }

  Widget _buildHeaderChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: const Color(0xFFD4A373)),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildTabButton(int index, String label) {
    final active = _activeTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeTab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: active ? const Color(0xFFD4A373) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: active ? Colors.black : Colors.grey,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActiveTabContent() {
    switch (_activeTab) {
      case 0:
        return _buildSummaryTab();
      case 1:
        return _buildLastOrderTab();
      case 2:
        return _buildInsightsTab();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildSummaryTab() {
    final rec = _data?['smart_recommendation'] as Map? ?? {};
    final score = rec['score'] as num? ?? 0;
    final priorityClass = rec['priority_class'] as String? ?? 'BAIXO';
    final suggestedAction = rec['suggested_action'] as String? ?? 'Sem ações sugeridas.';
    final reasons = rec['reasons'] as List? ?? [];
    final suggestedOrder = rec['suggested_order'] as List? ?? [];

    Color priorityColor = Colors.greenAccent;
    if (priorityClass == 'CRÍTICO') {
      priorityColor = Colors.redAccent;
    } else if (priorityClass == 'ALTO') {
      priorityColor = Colors.orangeAccent;
    } else if (priorityClass == 'MÉDIO') {
      priorityColor = Colors.amberAccent;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.02),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.06)),
          ),
          child: Row(
            children: [
              Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 64,
                    height: 64,
                    child: CircularProgressIndicator(
                      value: score / 100.0,
                      backgroundColor: Colors.white.withOpacity(0.05),
                      valueColor: AlwaysStoppedAnimation(priorityColor),
                      strokeWidth: 6,
                    ),
                  ),
                  Text(
                    '${score.toInt()}',
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
                  ),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('OPORTUNIDADE COMERCIAL', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 2),
                    Text(
                      'Prioridade: $priorityClass',
                      style: TextStyle(color: priorityColor, fontSize: 16, fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Métrica baseada em faturamento, inatividade e risco de ruptura.',
                      style: TextStyle(color: Colors.grey, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: priorityColor.withOpacity(0.06),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: priorityColor.withOpacity(0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.bolt_rounded, color: priorityColor, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Ação Sugerida (Next Best Action)',
                    style: TextStyle(color: priorityColor, fontSize: 13, fontWeight: FontWeight.w900),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                suggestedAction,
                style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.4, fontWeight: FontWeight.bold),
              ),
              if (reasons.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Divider(color: Colors.white10, height: 1),
                const SizedBox(height: 10),
                ...reasons.map((r) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 6, right: 8),
                        child: Icon(Icons.circle, size: 5, color: priorityColor),
                      ),
                      Expanded(
                        child: Text(
                          r.toString(),
                          style: const TextStyle(color: Colors.grey, fontSize: 11, height: 1.3),
                        ),
                      ),
                    ],
                  ),
                )),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Sugestão de Pedido (Next Best Action)',
          style: TextStyle(color: Color(0xFFF3E5D8), fontWeight: FontWeight.bold, fontSize: 14),
        ),
        const SizedBox(height: 8),
        if (suggestedOrder.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.02),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Giro do cliente estável. Sem necessidade de pedido adicional de segurança hoje.',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: suggestedOrder.length,
            itemBuilder: (context, index) {
              final item = suggestedOrder[index] as Map;
              final skuName = (item['name'] as String? ?? '').replaceFirst('Café Coffee Mais', '').trim();
              final suggestedQty = item['suggested_qty'] as num? ?? 0;
              final avgHist = item['avg_historical'] as num? ?? 0;
              
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.02),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withOpacity(0.04)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(skuName, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 2),
                          Text('Média Histórica: ${avgHist.toStringAsFixed(1)} cx', style: const TextStyle(color: Colors.grey, fontSize: 10)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFD4A373).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFD4A373).withOpacity(0.3)),
                      ),
                      child: Text(
                        '${suggestedQty.toInt()} cx',
                        style: const TextStyle(color: Color(0xFFD4A373), fontWeight: FontWeight.w900, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildLastOrderTab() {
    final orderDateStr = _data?['ultimo_pedido_data'] as String?;
    final orderDays = _data?['ultimo_pedido_dias'] as num?;
    final orderVal = _data?['ultimo_pedido_valor'] as num? ?? 0.0;
    final items = _data?['ultimo_pedido_itens'] as List? ?? [];
    
    if (orderDateStr == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 40.0),
          child: Text('Nenhum pedido anterior encontrado para este PDV.', style: TextStyle(color: Colors.grey, fontSize: 13)),
        ),
      );
    }
    
    String formattedDate = orderDateStr;
    try {
      final parts = orderDateStr.split('-');
      if (parts.length == 3) {
        formattedDate = '${parts[2]}/${parts[1]}/${parts[0]}';
      }
    } catch (_) {}
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.02),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.06)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildOrderDetailTile('Data da Compra', formattedDate, '$orderDays dias atrás'),
              _buildOrderDetailTile('Valor Líquido', 'R\$ ${orderVal.toStringAsFixed(2)}', 'Última carga'),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Itens do Último Pedido vs Média Histórica',
          style: TextStyle(color: Color(0xFFF3E5D8), fontWeight: FontWeight.bold, fontSize: 14),
        ),
        const SizedBox(height: 10),
        if (items.isEmpty)
          const Text('Nenhum item registrado no último pedido.', style: TextStyle(color: Colors.grey, fontSize: 12))
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index] as Map;
              final skuName = (item['name'] as String? ?? '').replaceFirst('Café Coffee Mais', '').trim();
              final qty = item['qty'] as num? ?? 0;
              final avgHist = item['avg_historical'] as num? ?? 0;
              
              final isBelow = qty < avgHist * 0.9;
              final isAbove = qty > avgHist * 1.1;
              
              Color statusColor = Colors.grey;
              IconData statusIcon = Icons.remove_rounded;
              String comparisonText = 'Na média';
              
              if (isBelow) {
                statusColor = Colors.orangeAccent;
                statusIcon = Icons.arrow_downward_rounded;
                comparisonText = 'Abaixo da média';
              } else if (isAbove) {
                statusColor = Colors.greenAccent;
                statusIcon = Icons.arrow_upward_rounded;
                comparisonText = 'Acima da média';
              }
              
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.02),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withOpacity(0.04)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(skuName, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Text('Qtd Compra: ${qty.toInt()} cx', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                              const SizedBox(width: 12),
                              Text('Média Histórica: ${avgHist.toStringAsFixed(1)} cx', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: statusColor.withOpacity(0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(statusIcon, size: 10, color: statusColor),
                          const SizedBox(width: 4),
                          Text(
                            comparisonText,
                            style: TextStyle(color: statusColor, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildOrderDetailTile(String label, String value, String sub) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
        const SizedBox(height: 2),
        Text(sub, style: const TextStyle(color: Color(0xFFD4A373), fontSize: 10, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildInsightsTab() {
    final trend = _data?['tendencia'] as String? ?? 'ESTÁVEL';
    final trendPct = _data?['tendencia_percentual'] as num? ?? 0;
    final insights = _data?['insights'] as List? ?? [];
    
    Color trendColor = Colors.grey;
    IconData trendIcon = Icons.trending_flat_rounded;
    if (trend == 'ALTA') {
      trendColor = Colors.greenAccent;
      trendIcon = Icons.trending_up_rounded;
    } else if (trend == 'QUEDA') {
      trendColor = Colors.redAccent;
      trendIcon = Icons.trending_down_rounded;
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.02),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.06)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('TENDÊNCIA DE SELL-IN', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(
                      'Comportamento: $trend',
                      style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: trendColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: trendColor.withOpacity(0.2)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(trendIcon, color: trendColor, size: 18),
                    if (trendPct != 0) ...[
                      const SizedBox(width: 6),
                      Text(
                        '${trendPct.abs()}%',
                        style: TextStyle(color: trendColor, fontWeight: FontWeight.w900, fontSize: 13),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Insights Comerciais & Giro',
          style: TextStyle(color: Color(0xFFF3E5D8), fontWeight: FontWeight.bold, fontSize: 14),
        ),
        const SizedBox(height: 10),
        if (insights.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.02),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Nenhum insight comercial crítico para este PDV.',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: insights.length,
            itemBuilder: (context, index) {
              final text = insights[index].toString();
              
              IconData bulletIcon = Icons.lightbulb_outline_rounded;
              Color bulletColor = const Color(0xFFD4A373);
              
              if (text.toLowerCase().contains('alerta') || text.toLowerCase().contains('ruptura')) {
                bulletIcon = Icons.warning_amber_rounded;
                bulletColor = Colors.orangeAccent;
              } else if (text.toLowerCase().contains('atenção') || text.toLowerCase().contains('queda')) {
                bulletIcon = Icons.error_outline_rounded;
                bulletColor = Colors.redAccent;
              } else if (text.toLowerCase().contains('destaque') || text.toLowerCase().contains('crescimento')) {
                bulletIcon = Icons.trending_up_rounded;
                bulletColor = Colors.greenAccent;
              }
              
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.02),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withOpacity(0.04)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(bulletIcon, color: bulletColor, size: 18),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        text,
                        style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 12, height: 1.4),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        const SizedBox(height: 24),
      ],
    );
  }
}
