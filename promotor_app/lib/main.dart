import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'core/constants/app_config.dart';
import 'core/providers/auth_provider.dart';
import 'core/services/log_service.dart';
import 'features/auth/login_screen.dart';
import 'features/dashboard/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Set default flavor configuration
  AppConfig.initialize(AppEnvironment.dev);

  // Initialize log service local box
  await LogService().initialize();

  // Capture Flutter Uncaught Errors
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    LogService().log(
      eventType: 'APP_CRASH',
      severity: 'CRITICAL',
      exception: details.exception,
      stackTrace: details.stack,
      payload: {'error_type': 'unhandled_flutter_error', 'message': details.exceptionAsString()},
    );
  };

  // Capture Platform/Async Uncaught Errors
  PlatformDispatcher.instance.onError = (error, stack) {
    LogService().log(
      eventType: 'APP_CRASH',
      severity: 'CRITICAL',
      exception: error,
      stackTrace: stack,
      payload: {'error_type': 'unhandled_async_error', 'message': error.toString()},
    );
    return true;
  };

  await SentryFlutter.init(
    (options) {
      options.dsn = 'https://f0e5b7c7b8e1465293297a7e8e50b86a@o4507000000000000.ingest.sentry.io/4507000000000000'; // Pilot DSN
      options.tracesSampleRate = 1.0;
    },
    appRunner: () => runApp(
      const ProviderScope(
        child: CoffeeMaisPromotorApp(),
      ),
    ),
  );
}

class CoffeeMaisPromotorApp extends ConsumerWidget {
  const CoffeeMaisPromotorApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    return MaterialApp(
      title: 'Coffee Mais - Promotores',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFFD4A373),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFD4A373),
          secondary: Color(0xFFE9C46A),
          surface: Color(0xFF23170F),
        ),
        scaffoldBackgroundColor: const Color(0xFF18100A),
        fontFamily: 'Roboto',
      ),
      home: _getHomeWidget(authState.status),
    );
  }

  Widget _getHomeWidget(AuthStatus status) {
    switch (status) {
      case AuthStatus.initial:
      case AuthStatus.loading:
        return const Scaffold(
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.coffee_rounded,
                  size: 64,
                  color: Color(0xFFD4A373),
                ),
                SizedBox(height: 24),
                CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFD4A373)),
                ),
              ],
            ),
          ),
        );
      case AuthStatus.authenticated:
        return const DashboardScreen();
      case AuthStatus.unauthenticated:
      case AuthStatus.pendingApproval:
      case AuthStatus.blocked:
      case AuthStatus.error:
        return const LoginScreen();
    }
  }
}
