import 'dart:io';

enum AppEnvironment {
  dev,
  staging,
  production,
}

class AppConfig {
  final AppEnvironment environment;
  final String apiBaseUrl;
  final String supabaseUrl;
  final String supabaseAnonKey;

  AppConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.supabaseUrl,
    required this.supabaseAnonKey,
  });

  static AppConfig? _current;
  static AppConfig get current => _current!;

  static void initialize(AppEnvironment env) {
    switch (env) {
      case AppEnvironment.dev:
        _current = AppConfig(
          environment: AppEnvironment.dev,
          // 10.0.2.2 is localhost in Android Emulator, 127.0.0.1 (or localhost) on iOS iOS
          apiBaseUrl: Platform.isAndroid ? 'http://10.0.2.2:3000' : 'http://localhost:3000',
          supabaseUrl: 'https://ncncazbhpoxjlyvcbvqa.supabase.co',
          supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTc3MjcsImV4cCI6MjA5MTE3MzcyN30.oiasBJu4C-ULzhACvszrSn7O1vM_v0hyJ_AYjzVRtoA',
        );
        break;
      case AppEnvironment.staging:
        _current = AppConfig(
          environment: AppEnvironment.staging,
          apiBaseUrl: 'https://staging-api.coffeemais.com.br',
          supabaseUrl: 'https://ncncazbhpoxjlyvcbvqa.supabase.co',
          supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTc3MjcsImV4cCI6MjA5MTE3MzcyN30.oiasBJu4C-ULzhACvszrSn7O1vM_v0hyJ_AYjzVRtoA',
        );
        break;
      case AppEnvironment.production:
        _current = AppConfig(
          environment: AppEnvironment.production,
          apiBaseUrl: 'https://api.coffeemais.com.br',
          supabaseUrl: 'https://ncncazbhpoxjlyvcbvqa.supabase.co',
          supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTc3MjcsImV4cCI6MjA5MTE3MzcyN30.oiasBJu4C-ULzhACvszrSn7O1vM_v0hyJ_AYjzVRtoA',
        );
        break;
    }
  }
}
