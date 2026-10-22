import 'dart:convert';

import 'package:fahazavana/features/live/subtitle_message.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('décode un message de sous-titre du worker', () {
    final bytes = utf8.encode(jsonEncode(
        {'seq': 3, 'startMs': 1000, 'endMs': 4200, 'lang': 'mg', 'text': 'Salama', 'final': true}));
    final msg = SubtitleMessage.tryParse(bytes)!;
    expect(msg.seq, 3);
    expect(msg.lang, 'mg');
    expect(msg.text, 'Salama');
  });

  test('ignore un message mal formé', () {
    expect(SubtitleMessage.tryParse(utf8.encode('pas du json')), isNull);
  });
}
