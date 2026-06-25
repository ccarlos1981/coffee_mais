import 'package:supabase_flutter/supabase_flutter.dart';
import '../constants/app_config.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    await Supabase.initialize(
      url: AppConfig.current.supabaseUrl,
      anonKey: AppConfig.current.supabaseAnonKey,
    );

    _initialized = true;
  }

  SupabaseClient get client => Supabase.instance.client;

  Session? get currentSession => client.auth.currentSession;
  User? get currentUser => client.auth.currentUser;

  Future<AuthResponse> login(String email, String password) async {
    return await client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  Future<void> logout() async {
    await client.auth.signOut();
  }

  bool get isAuthenticated => currentSession != null;
}
