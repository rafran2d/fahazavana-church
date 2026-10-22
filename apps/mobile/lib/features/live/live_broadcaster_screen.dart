import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:livekit_client/livekit_client.dart';

import '../../core/api_client.dart';
import 'live_repository.dart';

/// Écran prédicateur : démarre le live (audio seul au MVP), coupe/rétablit le micro, arrête.
class LiveBroadcasterScreen extends ConsumerStatefulWidget {
  const LiveBroadcasterScreen({super.key, required this.churchId});

  final String churchId;

  @override
  ConsumerState<LiveBroadcasterScreen> createState() => _LiveBroadcasterScreenState();
}

class _LiveBroadcasterScreenState extends ConsumerState<LiveBroadcasterScreen> {
  final _title = TextEditingController();
  Room? _room;
  String? _liveId;
  bool _busy = false;
  bool _micOn = true;
  DateTime? _startedAt;

  Future<void> _start() async {
    if (_title.text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      final conn = await ref.read(liveRepositoryProvider).start(widget.churchId, _title.text.trim());
      final room = Room(
        roomOptions: const RoomOptions(
          defaultAudioPublishOptions: AudioPublishOptions(dtx: true),
        ),
      );
      await room.connect(conn.wsUrl, conn.token);
      await room.localParticipant?.setMicrophoneEnabled(true);
      setState(() {
        _room = room;
        _liveId = conn.liveId;
        _startedAt = DateTime.now();
      });
    } catch (e) {
      _snack(apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleMic() async {
    final next = !_micOn;
    await _room?.localParticipant?.setMicrophoneEnabled(next);
    setState(() => _micOn = next);
  }

  Future<void> _stop() async {
    setState(() => _busy = true);
    try {
      if (_liveId != null) await ref.read(liveRepositoryProvider).stop(widget.churchId, _liveId!);
    } catch (e) {
      _snack(apiErrorMessage(e));
    }
    final room = _room;
    _room = null;
    await room?.disconnect();
    await room?.dispose();
    if (mounted) Navigator.of(context).pop();
  }

  void _snack(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  @override
  void dispose() {
    _title.dispose();
    _room?.disconnect();
    _room?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final live = _room != null;
    return Scaffold(
      appBar: AppBar(title: Text(live ? 'En direct' : 'Nouveau direct')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: live
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.podcasts, size: 96, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(_title.text, style: Theme.of(context).textTheme.titleLarge),
                  StreamBuilder(
                    stream: Stream.periodic(const Duration(seconds: 1)),
                    builder: (_, __) {
                      final d = DateTime.now().difference(_startedAt!);
                      return Text(
                          '${d.inMinutes.toString().padLeft(2, '0')}:${(d.inSeconds % 60).toString().padLeft(2, '0')}');
                    },
                  ),
                  const SizedBox(height: 32),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton.filledTonal(
                        iconSize: 32,
                        onPressed: _toggleMic,
                        icon: Icon(_micOn ? Icons.mic : Icons.mic_off),
                      ),
                      const SizedBox(width: 24),
                      FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: Colors.red),
                        onPressed: _busy ? null : _stop,
                        icon: const Icon(Icons.stop),
                        label: const Text('Terminer'),
                      ),
                    ],
                  ),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _title,
                    decoration: const InputDecoration(labelText: 'Titre de la prédication'),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: _busy ? null : _start,
                    icon: const Icon(Icons.podcasts),
                    label: const Text('Démarrer le direct'),
                  ),
                ],
              ),
      ),
    );
  }
}
