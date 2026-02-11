import express from 'express';
import axios from 'axios';
import cors from 'cors';
import https from 'https';

const app = express();

// --- CONFIGURACIÓN ---
const PORT = 3000;
const API_IA_URL = "https://trak-smart.trareysa.com:8093/api/chatbot/ask";
const API_TOKEN = "APIKEY_EMPRESA_SOFTGATE_001";

// Middleware
app.use(express.json());
app.use(cors());

// Agente para ignorar errores de certificado auto-firmado (usar con precaución)
const httpsAgent = new https.Agent({ 
    rejectUnauthorized: false,
    keepAlive: true // Mantiene la conexión abierta para mayor velocidad
});

// --- RUTA PRINCIPAL ---
app.post('/ask', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: "La pregunta es obligatoria." });
    }

    console.log(`[${new Date().toLocaleTimeString()}] 💬 Consulta recibida: "${question}"`);

    try {
        // Petición a la API externa de Trak-Smart
        const response = await axios.post(
            API_IA_URL,
            {
                message: question,
                vista: "CFDI",
                controladorOModulo: "SoporteCfdiController"
            },
            {
                headers: { 
                    "token": API_TOKEN,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                httpsAgent: httpsAgent,
                timeout: 45000 // 45 segundos por si la IA está saturada
            }
        );

        // Extracción segura de datos según la estructura de tu API
        const dataIA = response.data?.data;
        const textoRespuesta = dataIA?.outputText || "La IA no devolvió texto de respuesta.";
        const tokensUsados = dataIA?.tokensUsed || 0;

        console.log(`[${new Date().toLocaleTimeString()}] 🤖 IA respondió exitosamente.`);

        res.json({ 
            success: true,
            answer: textoRespuesta,
            meta: {
                tokens: tokensUsados,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        manejarError(error, res);
    }
});

// --- FUNCIÓN DE MANEJO DE ERRORES CENTRALIZADA ---
function manejarError(error, res) {
    if (error.response) {
        // La API respondió con un error (4xx o 5xx)
        console.error("❌ Error de API Externa:", error.response.status, error.response.data);
        return res.status(error.response.status).json({
            success: false,
            error: "Error en el servidor de IA",
            detalles: error.response.data
        });
    } else if (error.code === 'ECONNABORTED') {
        // Tiempo de espera agotado
        console.error("❌ Error: Tiempo de espera agotado (Timeout)");
        return res.status(504).json({
            success: false,
            error: "La IA tardó demasiado en responder. Intenta de nuevo."
        });
    } else {
        // Error de red o configuración
        console.error("❌ Error Crítico:", error.message);
        return res.status(500).json({
            success: false,
            error: "Fallo de conexión con el puente de IA",
            mensaje: error.message
        });
    }
}

// Iniciar servidor
app.listen(PORT, () => {
    console.log("================================================");
    console.log(`🚀 PUENTE IA TRAREYSA ACTIVO`);
    console.log(`📡 Escuchando en: http://localhost:${PORT}/ask`);
    console.log(`🔗 Destino: ${API_IA_URL}`);
    console.log("================================================");
});