import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

class DeviceFingerprintService {
  static final DeviceFingerprintService _instance = DeviceFingerprintService._internal();
  factory DeviceFingerprintService() => _instance;
  DeviceFingerprintService._internal();

  final _secureStorage = const FlutterSecureStorage();
  final _deviceInfoPlugin = DeviceInfoPlugin();
  
  static const String _uuidKey = 'secure_storage_device_uuid';
  String? _cachedFingerprint;

  Future<String> getFingerprint() async {
    if (_cachedFingerprint != null) return _cachedFingerprint!;

    // 1. Get or create secure storage UUID
    String? secureUuid = await _secureStorage.read(key: _uuidKey);
    if (secureUuid == null) {
      secureUuid = const Uuid().v4();
      await _secureStorage.write(key: _uuidKey, value: secureUuid);
    }

    // 2. Fetch native device info
    String vendorId = '';
    String model = '';
    String osVersion = '';
    String osName = Platform.isAndroid ? 'Android' : 'iOS';

    try {
      if (Platform.isAndroid) {
        final androidInfo = await _deviceInfoPlugin.androidInfo;
        vendorId = androidInfo.id; // Unique hardware ID
        model = androidInfo.model;
        osVersion = androidInfo.version.release;
      } else if (Platform.isIOS) {
        final iosInfo = await _deviceInfoPlugin.iosInfo;
        vendorId = iosInfo.identifierForVendor ?? 'unknown_ios_vendor_id';
        model = iosInfo.model;
        osVersion = iosInfo.systemVersion;
      }
    } catch (e) {
      vendorId = 'fallback_vendor_id';
      model = 'fallback_model';
      osVersion = 'fallback_os_version';
    }

    // 3. Compute hybrid SHA256 fingerprint
    final rawString = '${vendorId}_${model}_${osVersion}_$secureUuid';
    final bytes = utf8.encode(rawString);
    final digest = sha256.convert(bytes);

    _cachedFingerprint = digest.toString();
    return _cachedFingerprint!;
  }

  Future<Map<String, String>> getDeviceMetadata() async {
    String model = '';
    String osName = Platform.isAndroid ? 'Android' : 'iOS';
    String osVersion = '';

    try {
      if (Platform.isAndroid) {
        final androidInfo = await _deviceInfoPlugin.androidInfo;
        model = '${androidInfo.brand} ${androidInfo.model}';
        osVersion = androidInfo.version.release;
      } else if (Platform.isIOS) {
        final iosInfo = await _deviceInfoPlugin.iosInfo;
        model = iosInfo.name;
        osVersion = iosInfo.systemVersion;
      }
    } catch (_) {
      model = 'Unknown Device';
      osVersion = 'Unknown Version';
    }

    return {
      'device_model': model,
      'os_name': osName,
      'os_version': osVersion,
    };
  }
}
