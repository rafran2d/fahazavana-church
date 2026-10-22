import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/providers.dart';
import '../churches/churches_repository.dart';
import '../downloads/download_service.dart';

class SermonItem {
  SermonItem({required this.id, required this.title, required this.preacher, this.durationS});

  factory SermonItem.fromJson(Map<String, dynamic> json) => SermonItem(
        id: json['id'] as String,
        title: json['title'] as String,
        durationS: json['durationS'] as int?,
        preacher: ((json['preacher'] as Map)['user'] as Map)['name'] as String,
      );

  final String id;
  final String title;
  final String preacher;
  final int? durationS;
}

final sermonsProvider = FutureProvider.autoDispose.family<List<SermonItem>, String>((ref, churchId) async {
  final res = await ref.watch(apiClientProvider).dio.get('/churches/$churchId/sermons');
  return ((res.data as Map)['items'] as List)
      .map((e) => SermonItem.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Page d'une église : lives en cours + bibliothèque des prédications.
class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key, required this.churchId, required this.churchName});

  final String churchId;
  final String churchName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lives = ref.watch(activeLivesProvider(churchId));
    final sermons = ref.watch(sermonsProvider(churchId));

    return Scaffold(
      appBar: AppBar(title: Text(churchName)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(activeLivesProvider(churchId));
          ref.invalidate(sermonsProvider(churchId));
        },
        child: ListView(
          children: [
            ...lives.maybeWhen(
              data: (list) => list.map((l) => Card(
                    color: Theme.of(context).colorScheme.errorContainer,
                    margin: const EdgeInsets.all(12),
                    child: ListTile(
                      leading: const Icon(Icons.podcasts),
                      title: Text(l.title),
                      subtitle: Text('En direct — ${l.preacherName}'),
                      onTap: () => context.push('/churches/$churchId/lives/${l.id}'),
                    ),
                  )),
              orElse: () => const <Widget>[],
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Prédications', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            ...sermons.when(
              data: (list) => list.isEmpty
                  ? [const ListTile(title: Text('Aucune prédication pour le moment'))]
                  : list.map((s) => ListTile(
                        title: Text(s.title),
                        subtitle: Text(
                            '${s.preacher}${s.durationS != null ? ' · ${(s.durationS! / 60).round()} min' : ''}'),
                        trailing: IconButton(
                          icon: const Icon(Icons.download),
                          tooltip: 'Télécharger',
                          onPressed: () => _download(context, ref, s),
                        ),
                      )),
              loading: () => [const Center(child: CircularProgressIndicator())],
              error: (e, _) => [ListTile(title: Text(apiErrorMessage(e)))],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _download(BuildContext context, WidgetRef ref, SermonItem s) async {
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(SnackBar(content: Text('Téléchargement de « ${s.title} »…')));
    try {
      await ref.read(downloadServiceProvider).download(churchId: churchId, sermonId: s.id);
      messenger.showSnackBar(const SnackBar(content: Text('Disponible hors connexion')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
  }
}
