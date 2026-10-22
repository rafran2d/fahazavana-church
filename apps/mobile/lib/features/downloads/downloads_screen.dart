import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'download_service.dart';

/// Prédications disponibles hors connexion.
class DownloadsScreen extends ConsumerWidget {
  const DownloadsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final downloads = ref.watch(downloadsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Hors connexion')),
      body: downloads.when(
        data: (list) => list.isEmpty
            ? const Center(child: Text('Aucune prédication téléchargée'))
            : ListView.builder(
                itemCount: list.length,
                itemBuilder: (_, i) {
                  final s = list[i];
                  return ListTile(
                    leading: const Icon(Icons.offline_pin),
                    title: Text(s.title),
                    subtitle: s.durationS == null ? null : Text('${(s.durationS! / 60).round()} min'),
                    onTap: () => context.push('/downloads/${s.id}'),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () => ref.read(downloadServiceProvider).remove(s),
                    ),
                  );
                },
              ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
      ),
    );
  }
}
