import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import 'auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _registerMode = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = ref.read(authControllerProvider.notifier);
    if (_registerMode) {
      await auth.register(_name.text.trim(), _email.text.trim(), _password.text);
    } else {
      await auth.login(_email.text.trim(), _password.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 48),
            Text('Fahazavana', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            const Text('Prédications en direct, sous-titrées dans votre langue.'),
            const SizedBox(height: 32),
            if (_registerMode)
              TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nom')),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            TextField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Mot de passe'),
            ),
            const SizedBox(height: 16),
            if (state.hasError)
              Text(apiErrorMessage(state.error!),
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: state.isLoading ? null : _submit,
              child: Text(_registerMode ? 'Créer mon compte' : 'Se connecter'),
            ),
            TextButton(
              onPressed: () => setState(() => _registerMode = !_registerMode),
              child: Text(_registerMode ? "J'ai déjà un compte" : 'Créer un compte'),
            ),
            const Divider(height: 32),
            OutlinedButton.icon(
              onPressed: () => context.push('/downloads'),
              icon: const Icon(Icons.offline_pin_outlined),
              label: const Text('Écouter hors connexion'),
            ),
          ],
        ),
      ),
    );
  }
}
