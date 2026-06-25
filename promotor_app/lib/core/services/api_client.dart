import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../constants/app_config.dart';
import 'supabase_service.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  final _supabaseService = SupabaseService();

  Future<Map<String, String>> _getHeaders() async {
    final Map<String, String> headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    final Session? session = _supabaseService.currentSession;
    if (session != null) {
      headers['Authorization'] = 'Bearer ${session.accessToken}';
    }

    return headers;
  }

  Future<http.Response> get(String path) async {
    final url = Uri.parse('${AppConfig.current.apiBaseUrl}$path');
    final headers = await _getHeaders();
    return await http.get(url, headers: headers);
  }

  Future<http.Response> post(String path, dynamic body) async {
    final url = Uri.parse('${AppConfig.current.apiBaseUrl}$path');
    final headers = await _getHeaders();
    return await http.post(url, headers: headers, body: jsonEncode(body));
  }

  Future<http.StreamedResponse> postMultipart(
    String path, {
    required Map<String, String> fields,
    required List<http.MultipartFile> files,
  }) async {
    final url = Uri.parse('${AppConfig.current.apiBaseUrl}$path');
    final request = http.MultipartRequest('POST', url);
    
    // Get authorization headers
    final authHeaders = await _getHeaders();
    request.headers.addAll(authHeaders);
    
    // Add fields and files
    request.fields.addAll(fields);
    request.files.addAll(files);
    
    return await request.send();
  }
}
