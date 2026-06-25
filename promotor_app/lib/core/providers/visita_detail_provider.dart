import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/supabase_service.dart';

enum VisitaDetailStatus {
  initial,
  loading,
  loaded,
  error,
}

class VisitaDetailState {
  final VisitaDetailStatus status;
  final Map<String, dynamic>? visita;
  final Map<String, dynamic>? geoloc;
  final List<Map<String, dynamic>> missoes;
  final Map<String, dynamic> execucoes; // Map of missaoId -> respostas_checklist
  final List<Map<String, dynamic>> fotos;
  final String? errorMessage;

  VisitaDetailState({
    required this.status,
    this.visita,
    this.geoloc,
    required this.missoes,
    required this.execucoes,
    required this.fotos,
    this.errorMessage,
  });

  factory VisitaDetailState.initial() => VisitaDetailState(
        status: VisitaDetailStatus.initial,
        missoes: [],
        execucoes: {},
        fotos: [],
      );

  VisitaDetailState copyWith({
    VisitaDetailStatus? status,
    Map<String, dynamic>? visita,
    Map<String, dynamic>? geoloc,
    List<Map<String, dynamic>>? missoes,
    Map<String, dynamic>? execucoes,
    List<Map<String, dynamic>>? fotos,
    String? errorMessage,
  }) {
    return VisitaDetailState(
      status: status ?? this.status,
      visita: visita ?? this.visita,
      geoloc: geoloc ?? this.geoloc,
      missoes: missoes ?? this.missoes,
      execucoes: execucoes ?? this.execucoes,
      fotos: fotos ?? this.fotos,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

class VisitaDetailNotifier extends StateNotifier<VisitaDetailState> {
  final _supabase = SupabaseService().client;

  VisitaDetailNotifier() : super(VisitaDetailState.initial());

  Future<void> loadDetails(String visitaId) async {
    state = state.copyWith(status: VisitaDetailStatus.loading);
    try {
      // 1. Fetch visit and PDV info
      final visitRes = await _supabase
          .from('cm_promotor_visita')
          .select('*, pdv:base_atendimento(cod_parceiro, nome_fantasia, razao_social)')
          .eq('id', visitaId)
          .single();

      // 2. Fetch PDV geoloc
      final geolocRes = await _supabase
          .from('cm_promotor_pdv_geoloc')
          .select('*')
          .eq('cod_parceiro', visitRes['cod_parceiro'])
          .maybeSingle();

      // 3. Fetch Agenda details to retrieve promotor_id & date
      final agendaRes = await _supabase
          .from('cm_promotor_agenda_diaria')
          .select('promotor_id, data_agenda')
          .eq('id', visitRes['agenda_diaria_id'])
          .single();

      // 4. Fetch trade marketing missions
      final mvRes = await _supabase
          .from('cm_trade_missao_pdv')
          .select('missao_id, status, missao:cm_trade_missao(*)')
          .eq('promotor_id', agendaRes['promotor_id'])
          .eq('cod_parceiro', visitRes['cod_parceiro']);

      // Filter active missions by date range
      final dataAgenda = DateTime.parse(agendaRes['data_agenda'] as String);
      final List<Map<String, dynamic>> activeMissions = [];
      for (var item in mvRes) {
        if (item['missao'] != null) {
          final mInfo = item['missao'] as Map;
          final inicio = DateTime.parse(mInfo['data_inicio'] as String);
          final fim = DateTime.parse(mInfo['data_fim'] as String);
          if (dataAgenda.isAfter(inicio.subtract(const Duration(days: 1))) &&
              dataAgenda.isBefore(fim.add(const Duration(days: 1)))) {
            activeMissions.add(Map<String, dynamic>.from(item));
          }
        }
      }
    
      // 5. Fetch executed checklists for this visit
      final execsRes = await _supabase
          .from('cm_trade_missao_execucao')
          .select('*')
          .eq('visita_id', visitaId);

      final Map<String, dynamic> execMap = {};
      for (var item in execsRes) {
        execMap[item['missao_id'] as String] = item['respostas_checklist'];
      }
    
      // 6. Fetch visit photo album
      final photosRes = await _supabase
          .from('cm_promotor_visita_foto')
          .select('*')
          .eq('visita_id', visitaId)
          .eq('is_deleted', false)
          .order('ordem');

      final List<Map<String, dynamic>> photosList = List<Map<String, dynamic>>.from(
              (photosRes as List).map((x) => Map<String, dynamic>.from(x as Map)));

      state = state.copyWith(
        status: VisitaDetailStatus.loaded,
        visita: visitRes,
        geoloc: geolocRes,
        missoes: activeMissions,
        execucoes: execMap,
        fotos: photosList,
        errorMessage: null,
      );
    } catch (e) {
      state = state.copyWith(
        status: VisitaDetailStatus.error,
        errorMessage: e.toString(),
      );
    }
  }

  /// Locally updates a checklist answers in the UI state
  void updateLocalExecucao(String missaoId, Map<String, dynamic> respostas) {
    final updatedExecs = Map<String, dynamic>.from(state.execucoes);
    updatedExecs[missaoId] = respostas;
    state = state.copyWith(execucoes: updatedExecs);
  }

  /// Locally updates the visit status in the UI state
  void updateLocalStatus(String newStatus) {
    if (state.visita != null) {
      final updatedVisit = Map<String, dynamic>.from(state.visita!);
      updatedVisit['status'] = newStatus;
      state = state.copyWith(visita: updatedVisit);
    }
  }
}

// Global Provider Family for Visita Detail
final visitaDetailProvider = StateNotifierProvider.family<VisitaDetailNotifier, VisitaDetailState, String>((ref, visitaId) {
  final notifier = VisitaDetailNotifier();
  notifier.loadDetails(visitaId);
  return notifier;
});
