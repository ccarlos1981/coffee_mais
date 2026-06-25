import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import 'api_client.dart';
import 'image_compression_service.dart';
import 'log_service.dart';

enum SyncStatus {
  success,
  retry,
  stop,
  deadletter,
}

class SyncResult {
  final SyncStatus status;
  final String? errorMessage;

  SyncResult({required this.status, this.errorMessage});

  factory SyncResult.success() => SyncResult(status: SyncStatus.success);
  factory SyncResult.retry(String err) => SyncResult(status: SyncStatus.retry, errorMessage: err);
  factory SyncResult.stop(String err) => SyncResult(status: SyncStatus.stop, errorMessage: err);
  factory SyncResult.deadletter(String err) => SyncResult(status: SyncStatus.deadletter, errorMessage: err);

  static SyncResult fromResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return SyncResult.success();
    } else if (response.statusCode == 401 || response.statusCode == 403) {
      return SyncResult.stop('Server returned ${response.statusCode}: ${response.body}');
    } else if (response.statusCode >= 500) {
      return SyncResult.retry('Server error ${response.statusCode}: ${response.body}');
    } else {
      return SyncResult.deadletter('Validation error ${response.statusCode}: ${response.body}');
    }
  }

  static SyncResult fromStreamedResponse(http.StreamedResponse response, String body) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return SyncResult.success();
    } else if (response.statusCode == 401 || response.statusCode == 403) {
      return SyncResult.stop('Server returned ${response.statusCode}: $body');
    } else if (response.statusCode >= 500) {
      return SyncResult.retry('Server error ${response.statusCode}: $body');
    } else {
      return SyncResult.deadletter('Validation error ${response.statusCode}: $body');
    }
  }
}

class SyncQueueState {
  final int pendingHeartbeats;
  final int pendingActions;
  final int processingActions;
  final int syncedActions;
  final int failedActions;
  final int deadletterActions;
  final bool isSyncing;
  final String? lastError;
  final List<Map<String, dynamic>> actionsList;

  SyncQueueState({
    required this.pendingHeartbeats,
    required this.pendingActions,
    required this.processingActions,
    required this.syncedActions,
    required this.failedActions,
    required this.deadletterActions,
    required this.isSyncing,
    this.lastError,
    required this.actionsList,
  });

  SyncQueueState copyWith({
    int? pendingHeartbeats,
    int? pendingActions,
    int? processingActions,
    int? syncedActions,
    int? failedActions,
    int? deadletterActions,
    bool? isSyncing,
    String? lastError,
    List<Map<String, dynamic>>? actionsList,
  }) {
    return SyncQueueState(
      pendingHeartbeats: pendingHeartbeats ?? this.pendingHeartbeats,
      pendingActions: pendingActions ?? this.pendingActions,
      processingActions: processingActions ?? this.processingActions,
      syncedActions: syncedActions ?? this.syncedActions,
      failedActions: failedActions ?? this.failedActions,
      deadletterActions: deadletterActions ?? this.deadletterActions,
      isSyncing: isSyncing ?? this.isSyncing,
      lastError: lastError ?? this.lastError,
      actionsList: actionsList ?? this.actionsList,
    );
  }
}

class SyncQueueService extends StateNotifier<SyncQueueState> {
  final ApiClient _apiClient = ApiClient();
  final Connectivity _connectivity = Connectivity();
  StreamSubscription? _connectivitySubscription;

  late Box _heartbeatsBox;
  late Box _actionsBox;
  late Box _photosBox;

  bool _initialized = false;

  SyncQueueService()
      : super(SyncQueueState(
          pendingHeartbeats: 0,
          pendingActions: 0,
          processingActions: 0,
          syncedActions: 0,
          failedActions: 0,
          deadletterActions: 0,
          isSyncing: false,
          actionsList: [],
        ));

  Future<void> initialize() async {
    if (_initialized) return;

    await Hive.initFlutter();
    _heartbeatsBox = await Hive.openBox('pending_heartbeats_box');
    _actionsBox = await Hive.openBox('pending_actions_box');
    _photosBox = await Hive.openBox('pending_photos_box');

    _initialized = true;
    _updateCounts();

    _connectivitySubscription = _connectivity.onConnectivityChanged.listen((results) {
      final isOnline = _checkConnectivity(results);
      if (isOnline) {
        sync();
      }
    });

    sync();
  }

  bool _checkConnectivity(dynamic results) {
    if (results is List) {
      return results.isNotEmpty && !results.contains(ConnectivityResult.none);
    } else if (results is ConnectivityResult) {
      return results != ConnectivityResult.none;
    }
    return false;
  }

  void _updateCounts() {
    int pending = 0;
    int processing = 0;
    int synced = 0;
    int failed = 0;
    int deadletter = 0;

    final list = <Map<String, dynamic>>[];

    for (var key in _actionsBox.keys) {
      final action = Map<String, dynamic>.from(_actionsBox.get(key) as Map);
      list.add(action);

      final status = action['status'] as String? ?? 'pending';
      if (status == 'pending') {
        pending++;
      } else if (status == 'processing') processing++;
      else if (status == 'synced') synced++;
      else if (status == 'failed') failed++;
      else if (status == 'deadletter') deadletter++;
    }

    // Sort list by timestamp (newest first)
    list.sort((a, b) => (b['timestamp'] as String).compareTo(a['timestamp'] as String));

    state = state.copyWith(
      pendingHeartbeats: _heartbeatsBox.length,
      pendingActions: pending,
      processingActions: processing,
      syncedActions: synced,
      failedActions: failed,
      deadletterActions: deadletter,
      actionsList: list,
    );
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    super.dispose();
  }

  // --- Queue Methods ---

  Future<void> queueHeartbeat(Map<String, dynamic> heartbeat) async {
    if (!_initialized) await initialize();
    await _heartbeatsBox.add(heartbeat);
    _updateCounts();
    sync();
  }

  Future<String> queueAction(String type, Map<String, dynamic> data) async {
    if (!_initialized) await initialize();

    final actionId = const Uuid().v4();
    final action = {
      'id': actionId,
      'type': type,
      'data': {
        ...data,
        'client_action_id': actionId, // Inject client_action_id automatically
      },
      'status': 'pending',
      'retry_count': 0,
      'error_message': null as String?,
      'timestamp': DateTime.now().toIso8601String(),
    };

    await _actionsBox.put(actionId, action);
    _updateCounts();
    sync();
    return actionId;
  }

  Future<void> queuePhoto(String actionId, String filePath, String visitaId, String tipoFoto) async {
    if (!_initialized) await initialize();
    await _photosBox.add({
      'action_id': actionId,
      'file_path': filePath,
      'visita_id': visitaId,
      'tipo_foto': tipoFoto,
    });
    _updateCounts();
  }

  // --- Sync Engine ---

  Future<void> sync() async {
    if (state.isSyncing) return;
    if (!_initialized) await initialize();

    final connectivityResult = await _connectivity.checkConnectivity();
    final isOnline = _checkConnectivity(connectivityResult);
    if (!isOnline) {
      print('[SyncQueue] Device offline. Sync skipped.');
      return;
    }

    state = state.copyWith(isSyncing: true, lastError: null);
    print('[SyncQueue] Sync started...');

    try {
      final actionKeys = List.from(_actionsBox.keys);
      for (var key in actionKeys) {
        final action = Map<String, dynamic>.from(_actionsBox.get(key) as Map);
        final status = action['status'] as String? ?? 'pending';
        final actionId = action['id'] as String;

        // Process only pending or failed actions
        if (status != 'pending' && status != 'failed') {
          continue;
        }

        final type = action['type'] as String;
        final data = Map<String, dynamic>.from(action['data'] as Map);
        var retryCount = action['retry_count'] as int? ?? 0;

        print('[SyncQueue] Sincronizando: $type ($actionId). Retentativas: $retryCount');

        // Mark as processing
        action['status'] = 'processing';
        action['error_message'] = null;
        await _actionsBox.put(actionId, action);
        _updateCounts();

        SyncResult result;
        try {
          if (type == 'checkin') {
            result = await _syncCheckin(data);
          } else if (type == 'checkout') {
            result = await _syncCheckout(data);
          } else if (type == 'upload_foto') {
            result = await _syncUploadFoto(data);
          } else if (type == 'ocorrencia') {
            result = await _syncOcorrencia(data);
          } else if (type == 'missao') {
            result = await _syncMissao(data);
          } else if (type == 'ponto_in') {
            result = await _syncPonto(data, true);
          } else if (type == 'ponto_out') {
            result = await _syncPonto(data, false);
          } else if (type == 'feedback') {
            result = await _syncFeedback(data);
          } else if (type == 'shelf_ia') {
            result = await _syncShelfIa(data);
          } else {
            result = SyncResult.success();
          }
        } on SocketException catch (e) {
          result = SyncResult.retry('Connection timeout: ${e.message}');
        } on TimeoutException catch (e) {
          result = SyncResult.retry('Request timeout: ${e.message}');
        } catch (e) {
          result = SyncResult.retry('Unexpected network error: $e');
        }

        if (result.status == SyncStatus.success) {
          action['status'] = 'synced';
          action['error_message'] = null;
          await _actionsBox.put(actionId, action);
          _deleteAssociatedPhotos(actionId);
          print('[SyncQueue] Action $actionId synced.');
        } else if (result.status == SyncStatus.retry) {
          retryCount++;
          action['retry_count'] = retryCount;
          action['error_message'] = result.errorMessage;
          
          if (retryCount >= 5) {
            action['status'] = 'failed';
            action['error_message'] = 'Max retries (5) exceeded. Error: ${result.errorMessage}';
            print('[SyncQueue] Action $actionId failed permanently.');
          } else {
            action['status'] = 'failed';
            print('[SyncQueue] Action $actionId failed temporarily. Will retry.');
          }
          
          await _actionsBox.put(actionId, action);
          _updateCounts();
          break; // Stop queue processing on temporary network/500 errors
        } else if (result.status == SyncStatus.stop) {
          action['status'] = 'failed'; // Retain as failed for future attempts
          action['error_message'] = 'Sincronização interrompida (401/403): ${result.errorMessage}';
          await _actionsBox.put(actionId, action);
          _updateCounts();
          print('[SyncQueue] Sync stopped (Auth/Block). Ending queue run.');
          break; // Halt entire queue
        } else if (result.status == SyncStatus.deadletter) {
          action['status'] = 'deadletter';
          action['error_message'] = result.errorMessage;
          await _actionsBox.put(actionId, action);
          _updateCounts();
          print('[SyncQueue] Action $actionId marked as deadletter (Validation failure).');
        }
        _updateCounts();
      }

      // Process Heartbeats
      final heartbeatKeys = List.from(_heartbeatsBox.keys);
      for (var key in heartbeatKeys) {
        final hb = Map<String, dynamic>.from(_heartbeatsBox.get(key) as Map);
        try {
          final response = await _apiClient.post('/api/promotor/live/heartbeat', hb);
          if (response.statusCode == 200) {
            await _heartbeatsBox.delete(key);
          } else if (response.statusCode == 401 || response.statusCode == 403) {
            break;
          }
        } catch (_) {
          break;
        }
      }
    } catch (e) {
      print('[SyncQueue] Sync loop crash: $e');
    } finally {
      state = state.copyWith(isSyncing: false);
      _updateCounts();
    }
  }

  void _deleteAssociatedPhotos(String actionId) {
    try {
      final photoKeys = List.from(_photosBox.keys);
      for (var key in photoKeys) {
        final photo = _photosBox.get(key) as Map;
        if (photo['action_id'] == actionId) {
          final file = File(photo['file_path'] as String);
          if (file.existsSync()) {
            file.deleteSync();
          }
          _photosBox.delete(key);
        }
      }
    } catch (e) {
      print('[SyncQueue] Error cleaning up synced photo files: $e');
    }
  }

  Future<void> clearSyncedActions() async {
    final keys = List.from(_actionsBox.keys);
    for (var key in keys) {
      final action = _actionsBox.get(key) as Map;
      final status = action['status'] as String? ?? 'pending';
      if (status == 'synced' || status == 'deadletter') {
        await _actionsBox.delete(key);
      }
    }
    _updateCounts();
  }

  // --- Specific Action Sinks ---

  Future<SyncResult> _syncCheckin(Map<String, dynamic> data) async {
    final visitaId = data['visita_id'] as String;
    final latitude = data['latitude'].toString();
    final longitude = data['longitude'].toString();
    final timestamp = data['dispositivo_timestamp'] as String;
    final photoPath = data['foto_fachada_path'] as String;
    final clientActionId = data['client_action_id'] as String;

    final originalFile = File(photoPath);
    if (!originalFile.existsSync()) {
      return SyncResult.deadletter('Foto de checkin não encontrada no caminho local.');
    }

    final compressedFile = await ImageCompressionService().compressImage(originalFile);

    final multipartFile = await http.MultipartFile.fromPath(
      'foto_fachada',
      compressedFile.path,
    );

    final response = await _apiClient.postMultipart(
      '/api/promotor/visitas/checkin',
      fields: {
        'visita_id': visitaId,
        'latitude': latitude,
        'longitude': longitude,
        'dispositivo_timestamp': timestamp,
        'client_action_id': clientActionId,
      },
      files: [multipartFile],
    );

    final resBodyStr = await response.stream.bytesToString();
    final result = SyncResult.fromStreamedResponse(response, resBodyStr);
    if (result.status != SyncStatus.success) {
      LogService().log(
        eventType: 'PHOTO_UPLOAD_FAILED',
        severity: 'ERROR',
        payload: {
          'visita_id': visitaId,
          'tipo_foto': 'FACHADA',
          'client_action_id': clientActionId,
          'status': response.statusCode,
          'error': resBodyStr,
        },
      );
    }
    return result;
  }

  Future<SyncResult> _syncCheckout(Map<String, dynamic> data) async {
    final visitaId = data['visita_id'] as String;
    final latitude = data['latitude'].toString();
    final longitude = data['longitude'].toString();
    final timestamp = data['dispositivo_timestamp'] as String;
    final clientActionId = data['client_action_id'] as String;
    final photoPath = data['foto_execucao_path'] as String?;

    final List<http.MultipartFile> files = [];
    if (photoPath != null) {
      final originalFile = File(photoPath);
      if (originalFile.existsSync()) {
        final compressedFile = await ImageCompressionService().compressImage(originalFile);
        files.add(await http.MultipartFile.fromPath(
          'foto_execucao',
          compressedFile.path,
        ));
      }
    }

    final response = await _apiClient.postMultipart(
      '/api/promotor/visitas/checkout',
      fields: {
        'visita_id': visitaId,
        'latitude': latitude,
        'longitude': longitude,
        'dispositivo_timestamp': timestamp,
        'client_action_id': clientActionId,
      },
      files: files,
    );

    final resBodyStr = await response.stream.bytesToString();
    return SyncResult.fromStreamedResponse(response, resBodyStr);
  }

  Future<SyncResult> _syncUploadFoto(Map<String, dynamic> data) async {
    final visitaId = data['visita_id'] as String;
    final tipoFoto = data['tipo_foto'] as String;
    final descricao = data['descricao'] as String?;
    final latitude = data['latitude']?.toString();
    final longitude = data['longitude']?.toString();
    final takenAt = data['taken_at'] as String?;
    final ordem = data['ordem']?.toString();
    final clientActionId = data['client_action_id'] as String;
    final photoPath = data['foto_path'] as String;

    final originalFile = File(photoPath);
    if (!originalFile.existsSync()) {
      return SyncResult.deadletter('Foto de execução não encontrada localmente.');
    }

    final compressedFile = await ImageCompressionService().compressImage(originalFile);

    final multipartFile = await http.MultipartFile.fromPath(
      'foto',
      compressedFile.path,
    );

    final fields = {
      'visita_id': visitaId,
      'tipo_foto': tipoFoto,
      'client_action_id': clientActionId,
    };
    if (descricao != null) fields['descricao'] = descricao;
    if (latitude != null) fields['latitude'] = latitude;
    if (longitude != null) fields['longitude'] = longitude;
    if (takenAt != null) fields['taken_at'] = takenAt;
    if (ordem != null) fields['ordem'] = ordem;

    final response = await _apiClient.postMultipart(
      '/api/promotor/visitas/upload-foto',
      fields: fields,
      files: [multipartFile],
    );

    final resBodyStr = await response.stream.bytesToString();
    final result = SyncResult.fromStreamedResponse(response, resBodyStr);
    if (result.status != SyncStatus.success) {
      LogService().log(
        eventType: 'PHOTO_UPLOAD_FAILED',
        severity: 'ERROR',
        payload: {
          'visita_id': visitaId,
          'tipo_foto': tipoFoto,
          'client_action_id': clientActionId,
          'status': response.statusCode,
          'error': resBodyStr,
        },
      );
    }
    return result;
  }

  Future<SyncResult> _syncOcorrencia(Map<String, dynamic> data) async {
    final visitaId = data['visita_id'] as String;
    final tipoOcorrencia = data['tipo_ocorrencia'] as String;
    final descricao = data['descricao'] as String?;
    final clientActionId = data['client_action_id'] as String;
    final photoPath = data['foto_path'] as String?;

    final List<http.MultipartFile> files = [];
    if (photoPath != null) {
      final originalFile = File(photoPath);
      if (originalFile.existsSync()) {
        final compressedFile = await ImageCompressionService().compressImage(originalFile);
        files.add(await http.MultipartFile.fromPath(
          'foto',
          compressedFile.path,
        ));
      }
    }

    final response = await _apiClient.postMultipart(
      '/api/promotor/visitas/ocorrencia',
      fields: {
        'visita_id': visitaId,
        'tipo_ocorrencia': tipoOcorrencia,
        'descricao': descricao ?? '',
        'client_action_id': clientActionId,
      },
      files: files,
    );

    final resBodyStr = await response.stream.bytesToString();
    return SyncResult.fromStreamedResponse(response, resBodyStr);
  }

  Future<SyncResult> _syncMissao(Map<String, dynamic> data) async {
    final response = await _apiClient.post('/api/promotor/visitas/missao', data);
    return SyncResult.fromResponse(response);
  }

  Future<SyncResult> _syncPonto(Map<String, dynamic> data, bool isCheckin) async {
    final tipoRegistro = data['tipo_registro'] as String;
    final timestampDispositivo = data['timestamp_dispositivo'] as String;
    final latitude = data['latitude'].toString();
    final longitude = data['longitude'].toString();
    final gpsAccuracy = data['gps_accuracy']?.toString();
    final deviceInfo = data['device_info'] != null ? jsonEncode(data['device_info']) : '{}';
    final photoPath = data['foto_path'] as String;
    final clientActionId = data['client_action_id'] as String;

    final originalFile = File(photoPath);
    if (!originalFile.existsSync()) {
      return SyncResult.deadletter('Foto de selfie ponto não encontrada.');
    }

    final compressedFile = await ImageCompressionService().compressImage(originalFile);

    final multipartFile = await http.MultipartFile.fromPath(
      'foto',
      compressedFile.path,
    );

    final response = await _apiClient.postMultipart(
      '/api/promotor/ponto',
      fields: {
        'tipo_registro': tipoRegistro,
        'timestamp_dispositivo': timestampDispositivo,
        'latitude': latitude,
        'longitude': longitude,
        'gps_accuracy': gpsAccuracy ?? '10.0',
        'device_info': deviceInfo,
        'client_action_id': clientActionId,
      },
      files: [multipartFile],
    );

    final resBodyStr = await response.stream.bytesToString();
    return SyncResult.fromStreamedResponse(response, resBodyStr);
  }

  Future<SyncResult> _syncFeedback(Map<String, dynamic> data) async {
    final response = await _apiClient.post('/api/promotor/feedback', data);
    return SyncResult.fromResponse(response);
  }

  Future<SyncResult> _syncShelfIa(Map<String, dynamic> data) async {
    final visitaId = data['visita_id'] as String;
    final photoPath = data['foto_path'] as String;
    final width = data['width']?.toString() ?? '1920';
    final height = data['height']?.toString() ?? '1080';
    final capturedAt = data['captured_at'] as String?;
    final cameraMetadataStr = data['camera_metadata'] != null ? jsonEncode(data['camera_metadata']) : '{}';
    final clientActionId = data['client_action_id'] as String;

    final originalFile = File(photoPath);
    if (!originalFile.existsSync()) {
      return SyncResult.deadletter('Foto de prateleira não encontrada.');
    }

    final compressedFile = await ImageCompressionService().compressImage(originalFile);

    final multipartFile = await http.MultipartFile.fromPath(
      'foto',
      compressedFile.path,
    );

    final fields = {
      'visita_id': visitaId,
      'width': width,
      'height': height,
      'client_action_id': clientActionId,
      'captured_at': capturedAt ?? DateTime.now().toIso8601String(),
      'camera_metadata': cameraMetadataStr,
    };

    final response = await _apiClient.postMultipart(
      '/api/promotor/visitas/upload-shelf-photo',
      fields: fields,
      files: [multipartFile],
    );

    final resBodyStr = await response.stream.bytesToString();
    final result = SyncResult.fromStreamedResponse(response, resBodyStr);
    if (result.status != SyncStatus.success) {
      LogService().log(
        eventType: 'PHOTO_UPLOAD_FAILED',
        severity: 'ERROR',
        payload: {
          'visita_id': visitaId,
          'tipo_foto': 'SHELF_IA',
          'client_action_id': clientActionId,
          'status': response.statusCode,
          'error': resBodyStr,
        },
      );
    }
    return result;
  }
}

final syncQueueProvider = StateNotifierProvider<SyncQueueService, SyncQueueState>((ref) {
  final service = SyncQueueService();
  service.initialize();
  return service;
});
