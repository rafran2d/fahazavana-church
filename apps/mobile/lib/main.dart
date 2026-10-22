import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // TODO S7 : Firebase.initializeApp() + FirebaseMessaging (après flutterfire configure)
  runApp(const ProviderScope(child: FahazavanaApp()));
}

class FahazavanaApp extends ConsumerWidget {
  const FahazavanaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Fahazavana',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: const Color(0xFFB8860B), useMaterial3: true),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFFB8860B),
        brightness: Brightness.dark,
        useMaterial3: true,
      ),
      routerConfig: ref.watch(routerProvider),
    );
  }
}
