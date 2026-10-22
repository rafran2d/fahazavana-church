import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import 'churches_repository.dart';

class ChurchSearchScreen extends ConsumerStatefulWidget {
  const ChurchSearchScreen({super.key});

  @override
  ConsumerState<ChurchSearchScreen> createState() => _ChurchSearchScreenState();
}

class _ChurchSearchScreenState extends ConsumerState<ChurchSearchScreen> {
  List<ChurchSummary> _results = [];
  bool _loading = false;

  Future<void> _search(String q) async {
    setState(() => _loading = true);
    try {
      final results = await ref.read(churchesRepositoryProvider).search(q);
      setState(() => _results = results);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _follow(ChurchSummary church) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(churchesRepositoryProvider).follow(church.id);
      ref.invalidate(followedChurchesProvider);
      messenger.showSnackBar(SnackBar(content: Text('Vous suivez ${church.name}')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trouver une église')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Nom'),
              onSubmitted: _search,
            ),
          ),
          if (_loading) const LinearProgressIndicator(),
          Expanded(
            child: ListView.builder(
              itemCount: _results.length,
              itemBuilder: (_, i) {
                final c = _results[i];
                return ListTile(
                  title: Text(c.name),
                  subtitle: c.description == null ? null : Text(c.description!, maxLines: 2),
                  trailing: TextButton(onPressed: () => _follow(c), child: const Text('Suivre')),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
