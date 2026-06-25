import 'dart:io';
import 'package:geolocator/geolocator.dart';

class LocationService {
  static final LocationService _instance = LocationService._internal();
  factory LocationService() => _instance;
  LocationService._internal();

  /// Check location service status and permissions
  Future<bool> checkAndRequestPermissions() async {
    bool serviceEnabled;
    LocationPermission permission;

    // Test if location services are enabled.
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }
    
    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    // Optional background permission checks can be added here or handled by the background tracking package
    return true;
  }

  /// Fetch current GPS position
  Future<Position> getCurrentPosition() async {
    final hasPermission = await checkAndRequestPermissions();
    if (!hasPermission) {
      throw Exception('Permissão de geolocalização negada.');
    }

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
      timeLimit: const Duration(seconds: 10),
    );
  }

  /// Detect Mock GPS
  bool isMockLocation(Position position) {
    if (Platform.isAndroid) {
      // Geolocator Position has `isMocked` on Android
      return position.isMocked;
    }
    // On iOS, direct detection is restricted by Apple, but we can do validation checks if needed
    return false;
  }
}
