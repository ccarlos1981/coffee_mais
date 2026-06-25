import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_client.dart';
import '../services/location_service.dart';

enum AgendaStatus {
  initial,
  loading,
  loaded,
  pontoPendente,
  error,
}

class AgendaState {
  final AgendaStatus status;
  final String? agendaId;
  final String? jornadaId;
  final List<Map<String, dynamic>> visitas;
  final String? errorMessage;

  AgendaState({
    required this.status,
    this.agendaId,
    this.jornadaId,
    required this.visitas,
    this.errorMessage,
  });

  factory AgendaState.initial() => AgendaState(status: AgendaStatus.initial, visitas: []);

  AgendaState copyWith({
    AgendaStatus? status,
    String? agendaId,
    String? jornadaId,
    List<Map<String, dynamic>>? visitas,
    String? errorMessage,
  }) {
    return AgendaState(
      status: status ?? this.status,
      agendaId: agendaId ?? this.agendaId,
      jornadaId: jornadaId ?? this.jornadaId,
      visitas: visitas ?? this.visitas,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

class AgendaNotifier extends StateNotifier<AgendaState> {
  final _apiClient = ApiClient();
  final _locationService = LocationService();

  AgendaNotifier() : super(AgendaState.initial());

  Future<void> fetchAgenda() async {
    state = state.copyWith(status: AgendaStatus.loading);
    try {
      // 1. Get GPS coordinates to pass to endpoint for composite score sorting
      double? lat;
      double? lng;
      try {
        final pos = await _locationService.getCurrentPosition();
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (e) {
        print('[AgendaProvider] GPS coordinates unavailable: $e. Fetching without location.');
      }

      String path = '/api/promotor/agenda';
      if (lat != null && lng != null) {
        path += '?latitude=$lat&longitude=$lng';
      }

      final response = await _apiClient.get(path);
      final jsonResponse = jsonDecode(response.body);

      if (response.statusCode == 200) {
        final data = jsonResponse['data'] as Map;
        final list = List<Map<String, dynamic>>.from(
          (data['visitas'] as List).map((v) => Map<String, dynamic>.from(v as Map)),
        );

        state = state.copyWith(
          status: AgendaStatus.loaded,
          agendaId: data['agenda_diaria_id'] as String?,
          jornadaId: data['jornada_id'] as String?,
          visitas: list,
          errorMessage: null,
        );
      } else if (response.statusCode == 403 && jsonResponse['code'] == 'PONTO_PENDENTE') {
        state = state.copyWith(
          status: AgendaStatus.pontoPendente,
          visitas: [],
          errorMessage: jsonResponse['error'] as String?,
        );
      } else {
        state = state.copyWith(
          status: AgendaStatus.error,
          errorMessage: jsonResponse['error'] as String? ?? 'Erro ao consultar agenda.',
        );
      }
    } catch (e) {
      state = state.copyWith(
        status: AgendaStatus.error,
        errorMessage: e.toString(),
      );
    }
  }

  void forceStateToPontoPendente() {
    state = state.copyWith(status: AgendaStatus.pontoPendente, visitas: []);
  }
}

final agendaProvider = StateNotifierProvider<AgendaNotifier, AgendaState>((ref) {
  return AgendaNotifier();
});
