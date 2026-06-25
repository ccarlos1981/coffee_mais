import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:camera/camera.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:uuid/uuid.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/agenda_provider.dart';
import '../../core/providers/visita_detail_provider.dart';
import '../../core/services/sync_queue_service.dart';
import '../../core/services/location_service.dart';
import '../../core/services/device_fingerprint_service.dart';
import '../../core/services/log_service.dart';
import '../visitas/visita_detail_page.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _currentTab = 0;
  final _battery = Battery();
  final _locationService = LocationService();
  final _fingerprintService = DeviceFingerprintService();

  // Telemetry status
  int _batteryLevel = 100;
  BatteryState _batteryState = BatteryState.unknown;
  Position? _currentPosition;
  bool _isMockGps = false;
  bool _batteryCriticalLogged = false;
  String _fingerprint = 'Carregando...';
  String _connectionType = 'checking...';
  bool _offlineSimulation = false;
  bool _btnLoading = false;

  // Timers
  Timer? _heartbeatTimer;
  final List<String> _heartbeatLogs = [];

  @override
  void initState() {
    super.initState();
    _loadTelemetry().then((_) {
      // Fetch agenda once telemetry/location is ready
      ref.read(agendaProvider.notifier).fetchAgenda();
    });
    _startHeartbeatTimer();
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadTelemetry() async {
    try {
      final level = await _battery.batteryLevel;
      final state = await _battery.onBatteryStateChanged.first;
      final fp = await _fingerprintService.getFingerprint();

      // Check connectivity
      final conn = await Connectivity().checkConnectivity();
      String connStr = 'none';
      if (conn.contains(ConnectivityResult.wifi)) {
        connStr = 'wifi';
      } else if (conn.contains(ConnectivityResult.mobile)) {
        connStr = 'cellular';
      }

      // Battery Critical check
      final isCharging = state == BatteryState.charging;
      if (level < 15 && !isCharging) {
        if (!_batteryCriticalLogged) {
          _batteryCriticalLogged = true;
          LogService().log(
            eventType: 'BATTERY_CRITICAL',
            severity: 'WARN',
            payload: {
              'battery_level': level,
              'charging': isCharging,
            },
          );
        }
      } else {
        _batteryCriticalLogged = false;
      }

      setState(() {
        _batteryLevel = level;
        _batteryState = state;
        _fingerprint = fp;
        _connectionType = connStr;
      });

      // Get GPS
      final pos = await _locationService.getCurrentPosition();
      final isMock = _locationService.isMockLocation(pos);
      if (isMock && !_isMockGps) {
        LogService().log(
          eventType: 'GPS_MOCK_DETECTED',
          severity: 'CRITICAL',
          payload: {
            'latitude': pos.latitude,
            'longitude': pos.longitude,
          },
        );
      }

      setState(() {
        _currentPosition = pos;
        _isMockGps = isMock;
      });
    } catch (e) {
      print('Telemetry error: $e');
    }
  }

  void _startHeartbeatTimer() {
    _heartbeatTimer = Timer.periodic(const Duration(minutes: 3), (timer) async {
      final agendaState = ref.read(agendaProvider);
      if (agendaState.status == AgendaStatus.loaded) {
        await _sendHeartbeat();
      }
    });
  }

  Future<void> _sendHeartbeat() async {
    try {
      await _loadTelemetry();

      final hb = {
        'latitude': _currentPosition?.latitude ?? 0.0,
        'longitude': _currentPosition?.longitude ?? 0.0,
        'accuracy_m': _currentPosition?.accuracy ?? 10.0,
        'bateria_percent': _batteryLevel,
        'bateria_charging': _batteryState == BatteryState.charging,
        'tipo_conexao': _offlineSimulation ? 'none' : _connectionType,
      };

      await ref.read(syncQueueProvider.notifier).queueHeartbeat(hb);
      _logHeartbeat('Heartbeat registrado na fila.');
    } catch (e) {
      _logHeartbeat('Falha no Heartbeat: $e');
    }
  }

  void _logHeartbeat(String msg) {
    final now = DateTime.now().toLocal().toString().split('.')[0].split(' ')[1];
    setState(() {
      _heartbeatLogs.insert(0, '[$now] $msg');
      if (_heartbeatLogs.length > 20) {
        _heartbeatLogs.removeLast();
      }
    });
  }

  // --- Clock In / Out Action ---

  Future<void> _clockInOut(bool isEntering) async {
    await _loadTelemetry();
    
    if (_isMockGps) {
      LogService().log(
        eventType: 'GPS_MOCK_DETECTED',
        severity: 'CRITICAL',
        payload: {
          'action': isEntering ? 'ponto_in' : 'ponto_out',
          'latitude': _currentPosition?.latitude,
          'longitude': _currentPosition?.longitude,
        },
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('GPS Falso detectado! Batida de ponto bloqueada por compliance.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final photoPath = await _captureSelfie();
    if (photoPath == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor, tire uma selfie nítida para bater o ponto.')),
      );
      return;
    }

    setState(() {
      _btnLoading = true;
    });

    try {
      final metadata = await _fingerprintService.getDeviceMetadata();
      final pointData = {
        'tipo_registro': isEntering ? 'ENTRADA' : 'SAIDA',
        'timestamp_dispositivo': DateTime.now().toIso8601String(),
        'latitude': _currentPosition?.latitude ?? 0.0,
        'longitude': _currentPosition?.longitude ?? 0.0,
        'gps_accuracy': _currentPosition?.accuracy ?? 10.0,
        'device_info': {
          'fingerprint': _fingerprint,
          'model': metadata['device_model'],
          'os': metadata['os_name'],
          'os_version': metadata['os_version'],
        },
        'foto_path': photoPath,
      };

      final actionId = await ref.read(syncQueueProvider.notifier).queueAction(
            isEntering ? 'ponto_in' : 'ponto_out',
            pointData,
          );

      await ref.read(syncQueueProvider.notifier).queuePhoto(
            actionId,
            photoPath,
            'ponto',
            isEntering ? 'PONTO_ENTRADA' : 'PONTO_SAIDA',
          );

      _logHeartbeat('Ponto de ${isEntering ? 'Entrada' : 'Saída'} enfileirado.');
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Ponto de ${isEntering ? 'Entrada' : 'Saída'} enfileirado para envio.')),
      );

      // Force refresh on agenda
      Future.delayed(const Duration(seconds: 1), () {
        ref.read(agendaProvider.notifier).fetchAgenda();
      });

    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro ao bater ponto: $e')),
      );
    } finally {
      setState(() {
        _btnLoading = false;
      });
    }
  }

  Future<String?> _captureSelfie() async {
    final directory = Directory.systemTemp;
    final mockFile = File('${directory.path}/selfie_${DateTime.now().millisecondsSinceEpoch}.jpg');
    // ~280KB mock photo
    await mockFile.writeAsBytes(List.generate(280 * 1024, (index) => index % 256));
    return mockFile.path;
  }

  // --- Rendering tabs ---

  Widget _buildVisitasTab(AgendaState agendaState, SyncQueueState queueState) {
    if (agendaState.status == AgendaStatus.loading) {
      return const Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation(Color(0xFFD4A373))));
    }

    if (agendaState.status == AgendaStatus.pontoPendente) {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(Icons.lock_clock, size: 64, color: Colors.amberAccent),
          const SizedBox(height: 16),
          const Text(
            'Jornada Não Iniciada',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFFF3E5D8), fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Você deve registrar o ponto de ENTRADA com selfie biométrica para liberar sua agenda diária.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey, fontSize: 14),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _btnLoading ? null : () => _clockInOut(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD4A373),
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            icon: const Icon(Icons.camera_front_outlined),
            label: const Text('REGISTRAR ENTRADA', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ),
        ],
      );
    }

    if (agendaState.status == AgendaStatus.error) {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.cloud_off, size: 48, color: Colors.redAccent),
          const SizedBox(height: 12),
          Text(
            'Erro ao carregar dados:\n${agendaState.errorMessage}',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () => ref.read(agendaProvider.notifier).fetchAgenda(),
            child: const Text('TENTAR NOVAMENTE'),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Point registered status banner
        Card(
          color: Colors.white.withOpacity(0.04),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.white.withOpacity(0.08)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Jornada Ativa',
                      style: TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Entrada registrada com sucesso',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  ],
                ),
                ElevatedButton.icon(
                  onPressed: _btnLoading ? null : () => _clockInOut(false),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.redAccent.withOpacity(0.2),
                    foregroundColor: Colors.redAccent,
                    side: const BorderSide(color: Colors.redAccent),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(Icons.exit_to_app, size: 16),
                  label: const Text('SAÍDA'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),

        const Text(
          'Minha Rota (Ordenada por Proximidade)',
          style: TextStyle(color: Color(0xFFF3E5D8), fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),

        Expanded(
          child: agendaState.visitas.isEmpty
              ? const Center(
                  child: Text('Nenhuma visita programada para hoje.', style: TextStyle(color: Colors.grey)),
                )
              : ListView.builder(
                  itemCount: agendaState.visitas.length,
                  itemBuilder: (context, index) {
                    final visit = agendaState.visitas[index];
                    final pdv = visit['pdv'] as Map? ?? {};
                    final status = visit['status'] as String? ?? 'PLANEJADA';
                    final distance = visit['distancia_calculada_m'] as num?;

                    return Card(
                      color: Colors.white.withOpacity(0.02),
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: Colors.white.withOpacity(0.06)),
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => VisitaDetailPage(visitaId: visit['id']),
                            ),
                          ).then((_) {
                            // Refresh on back
                            ref.read(agendaProvider.notifier).fetchAgenda();
                          });
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      pdv['nome_fantasia'] as String? ?? 'Nome PDV',
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(Icons.location_on_outlined, size: 12, color: Colors.grey),
                                        const SizedBox(width: 4),
                                        Text(
                                          distance != null
                                              ? '${distance.toStringAsFixed(0)} metros de distância'
                                              : 'Localização indisponível',
                                          style: const TextStyle(color: Colors.grey, fontSize: 11),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              _buildStatusBadge(status),
                              const SizedBox(width: 8),
                              const Icon(Icons.chevron_right, color: Colors.white54),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildOfflineTab(SyncQueueState queueState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          color: Colors.white.withOpacity(0.04),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: Colors.white.withOpacity(0.08)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Simular Offline',
                          style: TextStyle(color: Color(0xFFF3E5D8), fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Acumula transações no Hive Box',
                          style: TextStyle(color: Colors.grey, fontSize: 12),
                        ),
                      ],
                    ),
                    Switch(
                      value: _offlineSimulation,
                      activeThumbColor: const Color(0xFFD4A373),
                      onChanged: (val) {
                        setState(() {
                          _offlineSimulation = val;
                        });
                        if (!val) {
                          ref.read(syncQueueProvider.notifier).sync();
                        }
                      },
                    ),
                  ],
                ),
                const Divider(height: 24, color: Colors.white10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildCounter('Ações', queueState.pendingActions),
                    _buildCounter('Falhas', queueState.failedActions),
                    _buildCounter('Rejeitadas', queueState.deadletterActions),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Fila de Ações Críticas',
              style: TextStyle(color: Color(0xFFF3E5D8), fontWeight: FontWeight.bold, fontSize: 16),
            ),
            TextButton(
              onPressed: () => ref.read(syncQueueProvider.notifier).clearSyncedActions(),
              child: const Text('Limpar concluídas', style: TextStyle(color: Color(0xFFD4A373), fontSize: 12)),
            )
          ],
        ),
        const SizedBox(height: 8),

        Expanded(
          child: queueState.actionsList.isEmpty
              ? const Center(child: Text('Nenhuma ação na fila local.', style: TextStyle(color: Colors.grey)))
              : ListView.builder(
                  itemCount: queueState.actionsList.length,
                  itemBuilder: (context, index) {
                    final item = queueState.actionsList[index];
                    final type = item['type'] as String;
                    final status = item['status'] as String? ?? 'pending';
                    final error = item['error_message'] as String?;

                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        '${type.toUpperCase()} (${item['id'].toString().substring(0, 8)})',
                        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        error ?? 'Aguardando envio assíncrono...',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                      trailing: _buildQueueStatusIcon(status),
                    );
                  },
                ),
        ),
        
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: queueState.isSyncing ? null : () => ref.read(syncQueueProvider.notifier).sync(),
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD4A373), foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(vertical: 14)),
          child: const Text('FORÇAR SINCRONIZAÇÃO DA FILA', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  Widget _buildDeviceTab(AuthState authState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          color: Colors.white.withOpacity(0.04),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: Colors.white.withOpacity(0.08)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Dados do Promotor', style: TextStyle(color: Color(0xFFF3E5D8), fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                _buildInfoRow('Promotor', authState.userProfile?['email'] ?? 'desconhecido'),
                _buildInfoRow('Fingerprint SHA256', _fingerprint, isSelectable: true),
                _buildInfoRow('Conexão atual', _offlineSimulation ? 'Offline (Simulado)' : _connectionType),
                _buildInfoRow('Bateria', '$_batteryLevel% (${_batteryState.name})'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        Card(
          color: Colors.white.withOpacity(0.04),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: Colors.white.withOpacity(0.08)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Localização Compliance', style: TextStyle(color: Color(0xFFF3E5D8), fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                _buildInfoRow('Latitude', _currentPosition?.latitude.toString() ?? '...'),
                _buildInfoRow('Longitude', _currentPosition?.longitude.toString() ?? '...'),
                _buildInfoRow('Precisão', '${_currentPosition?.accuracy.toStringAsFixed(1) ?? '...'}m'),
                const Divider(height: 24, color: Colors.white10),
                Row(
                  children: [
                    Icon(
                      _isMockGps ? Icons.cancel_outlined : Icons.check_circle_outline,
                      color: _isMockGps ? Colors.redAccent : Colors.greenAccent,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _isMockGps ? 'GPS FAKE DETECTADO!' : 'Rastreamento GPS Legítimo',
                      style: TextStyle(color: _isMockGps ? Colors.redAccent : Colors.greenAccent, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const Spacer(),
        ElevatedButton.icon(
          onPressed: _showFeedbackDialog,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFE9C46A),
            foregroundColor: Colors.black,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          icon: const Icon(Icons.bug_report_outlined),
          label: const Text('REPORTAR PROBLEMA', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () {
            ref.read(authProvider.notifier).logout();
          },
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.redAccent,
            side: const BorderSide(color: Colors.redAccent),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          icon: const Icon(Icons.exit_to_app),
          label: const Text('DESCONECTAR CONTA'),
        ),
      ],
    );
  }

  // --- UI Helpers ---

  Widget _buildQueueStatusIcon(String status) {
    switch (status) {
      case 'processing':
        return const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Color(0xFFD4A373))));
      case 'synced':
        return const Icon(Icons.check_circle, color: Colors.greenAccent, size: 20);
      case 'deadletter':
        return const Icon(Icons.cancel, color: Colors.redAccent, size: 20);
      case 'failed':
        return const Icon(Icons.error_outline_rounded, color: Colors.amberAccent, size: 20);
      case 'pending':
      default:
        return const Icon(Icons.watch_later_outlined, color: Colors.grey, size: 20);
    }
  }

  Widget _buildStatusBadge(String status) {
    Color color = Colors.grey;
    if (status == 'CHECKIN_REALIZADO') {
      color = Colors.amber;
    } else if (status == 'EM_EXECUCAO') color = Colors.amber[700]!;
    else if (status == 'CONCLUIDA') color = Colors.greenAccent;
    else if (status == 'LOJA_FECHADA' || status == 'NAO_REALIZADA') color = Colors.redAccent;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withOpacity(0.3))),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildCounter(String label, int val) {
    return Column(
      children: [
        Text(val.toString(), style: const TextStyle(color: Color(0xFFD4A373), fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isSelectable = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 2, child: Text(label, style: const TextStyle(color: Color(0xFFC4B5A6), fontSize: 13))),
          Expanded(
            flex: 3,
            child: isSelectable
                ? SelectableText(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500))
                : Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final agendaState = ref.watch(agendaProvider);
    final queueState = ref.watch(syncQueueProvider);
    final authState = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E130C),
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.coffee_rounded, color: Color(0xFFD4A373)),
            SizedBox(width: 10),
            Text('Jornada Promotor', style: TextStyle(color: Color(0xFFF3E5D8), fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFFF3E5D8)),
            onPressed: () {
              _loadTelemetry();
              ref.read(agendaProvider.notifier).fetchAgenda();
            },
          ),
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
        padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
        child: IndexedStack(
          index: _currentTab,
          children: [
            _buildVisitasTab(agendaState, queueState),
            _buildOfflineTab(queueState),
            _buildDeviceTab(authState),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTab,
        onTap: (index) {
          setState(() {
            _currentTab = index;
          });
        },
        backgroundColor: const Color(0xFF150D08),
        selectedItemColor: const Color(0xFFD4A373),
        unselectedItemColor: Colors.grey[600],
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.storefront), label: 'Visitas'),
          BottomNavigationBarItem(icon: Icon(Icons.offline_bolt_outlined), label: 'Sync Queue'),
          BottomNavigationBarItem(icon: Icon(Icons.perm_device_information_outlined), label: 'Dispositivo'),
        ],
      ),
    );
  }

  void _showFeedbackDialog() {
    String selectedCategory = 'GPS ruim';
    String selectedSeverity = 'MEDIUM';
    final descriptionController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E130C),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: const BorderSide(color: Colors.white10),
              ),
              title: const Row(
                children: [
                  Icon(Icons.bug_report_outlined, color: Color(0xFFE9C46A)),
                  SizedBox(width: 10),
                  Text('Reportar Problema', style: TextStyle(color: Color(0xFFF3E5D8), fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Selecione a categoria e relate o ocorrido para que a equipe de suporte possa analisar.',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                    const SizedBox(height: 16),
                    const Text('Categoria', style: TextStyle(color: Color(0xFFD4A373), fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      initialValue: selectedCategory,
                      dropdownColor: const Color(0xFF2C1E14),
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.black26,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'GPS ruim', child: Text('GPS ruim')),
                        DropdownMenuItem(value: 'App travou', child: Text('App travou')),
                        DropdownMenuItem(value: 'Bateria drenando', child: Text('Bateria drenando')),
                        DropdownMenuItem(value: 'Câmera falhou', child: Text('Câmera falhou')),
                        DropdownMenuItem(value: 'Sincronização lenta', child: Text('Sincronização lenta')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            selectedCategory = val;
                            if (val == 'App travou') {
                              selectedSeverity = 'CRITICAL';
                            } else if (val == 'Câmera falhou' || val == 'GPS ruim') {
                              selectedSeverity = 'HIGH';
                            } else if (val == 'Sincronização lenta') {
                              selectedSeverity = 'MEDIUM';
                            } else {
                              selectedSeverity = 'LOW';
                            }
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    const Text('Severidade', style: TextStyle(color: Color(0xFFD4A373), fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      initialValue: selectedSeverity,
                      dropdownColor: const Color(0xFF2C1E14),
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.black26,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'LOW', child: Text('LOW (Baixa)')),
                        DropdownMenuItem(value: 'MEDIUM', child: Text('MEDIUM (Média)')),
                        DropdownMenuItem(value: 'HIGH', child: Text('HIGH (Alta)')),
                        DropdownMenuItem(value: 'CRITICAL', child: Text('CRITICAL (Crítica)')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            selectedSeverity = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    const Text('Descrição', style: TextStyle(color: Color(0xFFD4A373), fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: descriptionController,
                      maxLines: 3,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Descreva o problema em detalhes...',
                        hintStyle: const TextStyle(color: Colors.grey, fontSize: 12),
                        filled: true,
                        fillColor: Colors.black26,
                        contentPadding: const EdgeInsets.all(12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('CANCELAR', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final desc = descriptionController.text.trim();
                    Navigator.of(context).pop();
                    await _submitFeedback(selectedCategory, selectedSeverity, desc);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE9C46A),
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('ENVIAR', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _submitFeedback(String category, String severity, String description) async {
    try {
      final metadata = await _fingerprintService.getDeviceMetadata();
      
      final feedbackData = {
        'category': category,
        'severity': severity,
        'description': description.isNotEmpty ? description : null,
        'device_timestamp': DateTime.now().toIso8601String(),
        'latitude': _currentPosition?.latitude,
        'longitude': _currentPosition?.longitude,
        'device_info': {
          'fingerprint': _fingerprint,
          'model': metadata['device_model'],
          'os': metadata['os_name'],
          'os_version': metadata['os_version'],
        },
      };

      await ref.read(syncQueueProvider.notifier).queueAction('feedback', feedbackData);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Relato de "$category" enfileirado para envio offline.',
            style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
          ),
          backgroundColor: const Color(0xFFE9C46A),
        ),
      );
      
      ref.read(syncQueueProvider.notifier).sync();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro ao salvar relato: $e'), backgroundColor: Colors.redAccent),
      );
    }
  }
}
