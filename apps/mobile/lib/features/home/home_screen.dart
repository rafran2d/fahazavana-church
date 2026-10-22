import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_controller.dart';
import '../churches/churches_repository.dart';
import '../downloads/download_service.dart';

/// Accueil : églises suivies ; actions du staff selon le rôle.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    // Contenus offline dont l'accès a été retiré (hors ligne : ignoré silencieusement)
    ref.read(downloadServiceProvider).syncAccess().catchError((_) => 0);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).valueOrNull;
    final followed = ref.watch(followedChurchesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Bonjour ${session?.name ?? ''}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.offline_pin_outlined),
            tooltip: 'Hors connexion',
            onPressed: () => context.push('/downloads'),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      floatingActionButton: session?.isPreacher == true
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/broadcast/${session!.staffChurchId}'),
              icon: const Icon(Icons.podcasts),
              label: const Text('Démarrer un direct'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(followedChurchesProvider),
        child: ListView(
          children: [
            if (session?.staffChurchId != null)
              ListTile(
                leading: const Icon(Icons.church),
                title: Text(session!.staffChurchName ?? 'Mon église'),
                subtitle: Text(session.isChurchAdmin ? 'Church Admin' : 'Prédicateur'),
                onTap: () => context.push(
                    '/churches/${session.staffChurchId}?name=${Uri.encodeComponent(session.staffChurchName ?? '')}'),
              ),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Églises suivies', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            ...followed.when(
              data: (list) => [
                for (final c in list)
                  ListTile(
                    title: Text(c.name),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () =>
                        context.push('/churches/${c.id}?name=${Uri.encodeComponent(c.name)}'),
                  ),
              ],
              loading: () => [const Center(child: CircularProgressIndicator())],
              error: (e, _) => [ListTile(title: Text('$e'))],
            ),
            ListTile(
              leading: const Icon(Icons.search),
              title: const Text('Trouver une église'),
              onTap: () => context.push('/churches'),
            ),
          ],
        ),
      ),
    );
  }
}
