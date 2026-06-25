import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:promotor_app/main.dart';

void main() {
  testWidgets('App initialization smoke test', (WidgetTester tester) async {
    // Build our app under ProviderScope and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: CoffeeMaisPromotorApp(),
      ),
    );

    // Verify that the splash/loading screen is displayed initially.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
