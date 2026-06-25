import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class AiShelfCapturePage extends StatefulWidget {
  const AiShelfCapturePage({super.key});

  @override
  State<AiShelfCapturePage> createState() => _AiShelfCapturePageState();
}

class _AiShelfCapturePageState extends State<AiShelfCapturePage> {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  bool _initializing = true;
  bool _hasError = false;
  String _errorMessage = "";

  @override
  void initState() {
    super.initState();
    // 1. Lock screen orientation to landscape for shelf capture layout guidance
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        setState(() {
          _initializing = false;
          _hasError = true;
          _errorMessage = "Nenhuma câmera física detectada no dispositivo.";
        });
        return;
      }

      // Find the back camera
      final backCamera = _cameras.firstWhere(
        (camera) => camera.lensDirection == CameraLensDirection.back,
        orElse: () => _cameras.first,
      );

      // ResolutionPreset.veryHigh guarantees 1920x1080 (1080p)
      _controller = CameraController(
        backCamera,
        ResolutionPreset.veryHigh,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );

      await _controller!.initialize();

      // Lock camera controller to landscape
      await _controller!.lockCaptureOrientation(DeviceOrientation.landscapeLeft);

      if (mounted) {
        setState(() {
          _initializing = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _initializing = false;
          _hasError = true;
          _errorMessage = "Falha ao inicializar a câmera: $e";
        });
      }
    }
  }

  Future<void> _capturePhoto() async {
    if (_controller == null || !_controller!.value.isInitialized) {
      // Fallback for emulator: generate mock image
      _captureMockPhoto();
      return;
    }

    try {
      final file = await _controller!.takePicture();
      if (mounted) {
        Navigator.pop(context, file.path);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao capturar foto: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _captureMockPhoto() async {
    try {
      final directory = Directory.systemTemp;
      final mockFile = File(
          '${directory.path}/shelf_mock_${DateTime.now().millisecondsSinceEpoch}.jpg');
      
      // Generate a mock shelf picture (~310 KB bytes)
      final bytes = List.generate(310 * 1024, (i) => i % 256);
      await mockFile.writeAsBytes(bytes);

      if (mounted) {
        Navigator.pop(context, mockFile.path);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro ao gerar foto simulada: $e')),
      );
    }
  }

  @override
  void dispose() {
    // Revert screen orientation back to portrait upon exiting
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Camera Preview or Simulators
          if (_initializing)
            const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation(Color(0xFFD4A373)),
              ),
            )
          else if (_hasError || _controller == null || !_controller!.value.isInitialized)
            // Emulator / Error view with simulated camera button
            _buildSimulatedCameraView()
          else
            CameraPreview(_controller!),

          // 2. Translucent Grid Overlay (Planogram alignment guide)
          if (!_initializing && !_hasError && _controller != null && _controller!.value.isInitialized)
            _buildCameraGuidesOverlay(),

          // 3. Close Button
          Positioned(
            top: 20,
            left: 20,
            child: SafeArea(
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.black54,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
            ),
          ),

          // 4. Instructions Box
          Positioned(
            top: 20,
            right: 20,
            child: SafeArea(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xB2000000),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white24),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.auto_awesome, color: Color(0xFFD4A373), size: 16),
                    SizedBox(width: 8),
                    Text(
                      'ALINHAMENTO DE GÔNDOLA POR IA',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.0,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSimulatedCameraView() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A120B), Color(0xFF0F0804)],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.camera_enhance_outlined, size: 56, color: Color(0xFFD4A373)),
            const SizedBox(height: 12),
            Text(
              _errorMessage.isNotEmpty ? _errorMessage : "Câmera simulada ativa (Ambiente de Teste)",
              style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              "Alinhe os limites da gôndola para simular a auditoria.",
              style: TextStyle(color: Colors.grey, fontSize: 11),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _captureMockPhoto,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD4A373),
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.photo_camera_outlined),
              label: const Text('CAPTURAR (SIMULADO)', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCameraGuidesOverlay() {
    return IgnorePointer(
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Semi-translucent screen borders with a clear region of interest in the middle
          ColorFiltered(
            colorFilter: ColorFilter.mode(
              Colors.black.withOpacity(0.5),
              BlendMode.srcOut,
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(
                  color: Colors.black,
                ),
                Align(
                  alignment: Alignment.center,
                  child: Container(
                    width: MediaQuery.of(context).size.width * 0.8,
                    height: MediaQuery.of(context).size.height * 0.7,
                    decoration: BoxDecoration(
                      color: Colors.red, // placeholder to slice out the transparent hole
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Bounding Box Guide Line
          Align(
            alignment: Alignment.center,
            child: Container(
              width: MediaQuery.of(context).size.width * 0.8,
              height: MediaQuery.of(context).size.height * 0.7,
              decoration: BoxDecoration(
                border: Border.all(
                  color: const Color(0xFFD4A373),
                  width: 2.0,
                  style: BorderStyle.solid,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Stack(
                children: [
                  // Horizontal Grid Guidelines
                  Align(
                    alignment: Alignment(0, -0.33),
                    child: Divider(color: Colors.white30, height: 1, thickness: 1),
                  ),
                  Align(
                    alignment: Alignment(0, 0.33),
                    child: Divider(color: Colors.white30, height: 1, thickness: 1),
                  ),
                ],
              ),
            ),
          ),
          // Capture button bar overlay
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 20),
              color: Colors.black38,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  GestureDetector(
                    onTap: _capturePhoto,
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: const BoxDecoration(
                        color: Colors.white30,
                        shape: BoxShape.circle,
                      ),
                      padding: const EdgeInsets.all(4),
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.camera_alt,
                          size: 32,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
