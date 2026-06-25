import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/supabase_service.dart';
import '../services/device_fingerprint_service.dart';
import '../services/api_client.dart';
import '../services/log_service.dart';

enum AuthStatus {
  initial,
  loading,
  authenticated,
  unauthenticated,
  pendingApproval,
  blocked,
  error,
}

class AuthState {
  final AuthStatus status;
  final String? errorMessage;
  final String? deviceFingerprint;
  final Map<String, dynamic>? userProfile;

  AuthState({
    required this.status,
    this.errorMessage,
    this.deviceFingerprint,
    this.userProfile,
  });

  factory AuthState.initial() => AuthState(status: AuthStatus.initial);

  AuthState copyWith({
    AuthStatus? status,
    String? errorMessage,
    String? deviceFingerprint,
    Map<String, dynamic>? userProfile,
  }) {
    return AuthState(
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
      deviceFingerprint: deviceFingerprint ?? this.deviceFingerprint,
      userProfile: userProfile ?? this.userProfile,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final _supabaseService = SupabaseService();
  final _fingerprintService = DeviceFingerprintService();
  final _apiClient = ApiClient();

  AuthNotifier() : super(AuthState.initial());

  Future<void> checkSession() async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      await _supabaseService.initialize();
      if (_supabaseService.isAuthenticated) {
        final fingerprint = await _fingerprintService.getFingerprint();
        final success = await _validateDevice(fingerprint);
        if (success) {
          state = state.copyWith(
            status: AuthStatus.authenticated,
            deviceFingerprint: fingerprint,
            userProfile: {
              'email': _supabaseService.currentUser?.email,
              'id': _supabaseService.currentUser?.id,
            },
          );
        }
      } else {
        state = state.copyWith(status: AuthStatus.unauthenticated);
      }
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      await _supabaseService.initialize();
      await _supabaseService.login(email, password);

      final fingerprint = await _fingerprintService.getFingerprint();
      final success = await _validateDevice(fingerprint);

      if (success) {
        state = state.copyWith(
          status: AuthStatus.authenticated,
          deviceFingerprint: fingerprint,
          userProfile: {
            'email': _supabaseService.currentUser?.email,
            'id': _supabaseService.currentUser?.id,
          },
        );
      }
    } catch (e) {
      final errorMsg = e.toString().replaceFirst('Exception: ', '');

      // Log login failure to local box (will sync when online & authenticated)
      await LogService().log(
        eventType: 'LOGIN_FAILED',
        severity: 'WARN',
        payload: {
          'email': email,
          'error': errorMsg,
        },
      );

      // Clean up Supabase session if device binding rejected or general login failed
      await _supabaseService.logout();
      
      if (errorMsg.contains('DEVICE_PENDING_APPROVAL')) {
        state = state.copyWith(
          status: AuthStatus.pendingApproval,
          errorMessage: 'Novo aparelho detectado. Solicite a aprovação do seu supervisor no painel.',
        );
      } else if (errorMsg.contains('DEVICE_BLOCKED')) {
        state = state.copyWith(
          status: AuthStatus.blocked,
          errorMessage: 'Este aparelho foi bloqueado pelo supervisor e não pode acessar o sistema.',
        );
      } else {
        state = state.copyWith(
          status: AuthStatus.error,
          errorMessage: errorMsg,
        );
      }
    }
  }

  Future<void> logout() async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      await _supabaseService.logout();
      state = AuthState(status: AuthStatus.unauthenticated);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
    }
  }

  Future<bool> _validateDevice(String fingerprint) async {
    final metadata = await _fingerprintService.getDeviceMetadata();
    
    final payload = {
      'device_fingerprint': fingerprint,
      'device_model': metadata['device_model'],
      'os_name': metadata['os_name'],
      'os_version': metadata['os_version'],
      'app_version': '1.0.0', // Configured App Version
    };

    try {
      final response = await _apiClient.post('/api/promotor/device/validate', payload);
      final jsonResponse = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return true;
      } else {
        final code = jsonResponse['code'] as String?;
        if (code != null) {
          throw Exception(code); // Throws either DEVICE_PENDING_APPROVAL or DEVICE_BLOCKED
        }
        throw Exception(jsonResponse['error'] ?? 'Erro ao validar dispositivo.');
      }
    } catch (e) {
      rethrow;
    }
  }
}

// Global Provider for Auth
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final notifier = AuthNotifier();
  notifier.checkSession();
  return notifier;
});
