import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'api_client.dart';
import 'device_fingerprint_service.dart';
import 'supabase_service.dart';

class LogService {
  static final LogService _instance = LogService._internal();
  factory LogService() => _instance;
  LogService._internal();

  late Box _logsBox;
  final ApiClient _apiClient = ApiClient();
  final DeviceFingerprintService _fingerprintService = DeviceFingerprintService();
  final SupabaseService _supabaseService = SupabaseService();
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    _logsBox = await Hive.openBox('mobile_app_logs_box');
    _initialized = true;
  }

  /// Writes a log to the local queue. If online and severity is high, immediately triggers sync.
  Future<void> log({
    required String eventType,
    required String severity,
    Map<String, dynamic>? payload,
    dynamic exception,
    StackTrace? stackTrace,
  }) async {
    if (!_initialized) await initialize();

    final fingerprint = await _fingerprintService.getFingerprint();
    final deviceMeta = await _fingerprintService.getDeviceMetadata();
    
    final osName = deviceMeta['os_name'] ?? 'Unknown';
    final osVersion = deviceMeta['os_version'] ?? '';
    final model = deviceMeta['device_model'] ?? 'Generic';

    final logEntry = {
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      'device_id': fingerprint,
      'app_version': '1.0.0',
      'os': '$osName $osVersion ($model)'.trim(),
      'event_type': eventType,
      'severity': severity,
      'payload_json': payload ?? {},
      'created_at': DateTime.now().toIso8601String(),
    };

    // Store in Hive box
    await _logsBox.add(logEntry);

    // Forward to Sentry if ERROR or CRITICAL
    if (severity == 'ERROR' || severity == 'CRITICAL') {
      final sentryLevel = severity == 'CRITICAL' ? SentryLevel.fatal : SentryLevel.error;
      if (exception != null) {
        await Sentry.captureException(
          exception,
          stackTrace: stackTrace,
          withScope: (scope) {
            scope.level = sentryLevel;
            scope.setTag('event_type', eventType);
            scope.setTag('device_id', fingerprint);
            if (payload != null) {
              scope.setContexts('payload', payload);
            }
          },
        );
      } else {
        await Sentry.captureMessage(
          '$eventType: ${payload != null ? jsonEncode(payload) : "No details"}',
          level: sentryLevel,
          withScope: (scope) {
            scope.setTag('event_type', eventType);
            scope.setTag('device_id', fingerprint);
          },
        );
      }
    }

    // Proactively try to sync logs
    syncLogs();
  }

  /// Uploads only relevant events (severity WARN/ERROR/CRITICAL) to the server
  Future<void> syncLogs() async {
    if (!_initialized) await initialize();
    if (_logsBox.isEmpty) return;

    if (!_supabaseService.isAuthenticated) {
      return; // Can only sync logs to Next.js API if authenticated
    }

    final keys = List.from(_logsBox.keys);
    final List<Map<String, dynamic>> logsToSync = [];
    final List<dynamic> keysToSync = [];

    for (var key in keys) {
      final log = Map<String, dynamic>.from(_logsBox.get(key) as Map);
      final severity = log['severity'] as String? ?? 'INFO';
      
      // Filter out INFO logs to optimize payload and database size
      if (severity == 'WARN' || severity == 'ERROR' || severity == 'CRITICAL') {
        logsToSync.add(log);
        keysToSync.add(key);
      } else {
        // INFO logs can be purged directly
        await _logsBox.delete(key);
      }
    }

    if (logsToSync.isEmpty) return;

    try {
      final response = await _apiClient.post('/api/promotor/log', logsToSync);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        // Delete successfully synced logs from local storage
        for (var key in keysToSync) {
          await _logsBox.delete(key);
        }
        print('[LogService] Synced ${logsToSync.length} logs with server.');
      } else {
        print('[LogService] Failed to sync logs: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('[LogService] Error syncing logs: $e');
    }
  }
}
