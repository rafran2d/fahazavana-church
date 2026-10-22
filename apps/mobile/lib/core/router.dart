import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_controller.dart';
import '../features/auth/login_screen.dart';
import '../features/churches/church_search_screen.dart';
import '../features/downloads/downloads_screen.dart';
import '../features/downloads/offline_player_screen.dart';
import '../features/home/home_screen.dart';
import '../features/library/library_screen.dart';
import '../features/live/live_broadcaster_screen.dart';
import '../features/live/live_viewer_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      if (auth.isLoading && !auth.hasValue) return null;
      final loggedIn = auth.valueOrNull != null;
      final onLogin = state.matchedLocation == '/login';
      // Les téléchargements restent accessibles sans session (usage hors connexion)
      final offline = state.matchedLocation.startsWith('/downloads');
      if (!loggedIn && !onLogin && !offline) return '/login';
      if (loggedIn && onLogin) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/churches', builder: (_, __) => const ChurchSearchScreen()),
      GoRoute(
        path: '/churches/:churchId',
        builder: (_, s) => LibraryScreen(
          churchId: s.pathParameters['churchId']!,
          churchName: s.uri.queryParameters['name'] ?? 'Église',
        ),
      ),
      GoRoute(
        path: '/churches/:churchId/lives/:liveId',
        builder: (_, s) => LiveViewerScreen(
          churchId: s.pathParameters['churchId']!,
          liveId: s.pathParameters['liveId']!,
        ),
      ),
      GoRoute(
        path: '/broadcast/:churchId',
        builder: (_, s) => LiveBroadcasterScreen(churchId: s.pathParameters['churchId']!),
      ),
      GoRoute(path: '/downloads', builder: (_, __) => const DownloadsScreen()),
      GoRoute(
        path: '/downloads/:sermonId',
        builder: (_, s) => OfflinePlayerScreen(sermonId: s.pathParameters['sermonId']!),
      ),
    ],
  );
});
