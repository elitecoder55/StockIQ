using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text;

namespace StockApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AiController : ControllerBase
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        public AiController(IConfiguration configuration)
        {
            _configuration = configuration;
            _httpClient = new HttpClient();
        }

        [HttpPost("ask")]
        public async Task<IActionResult> Ask([FromBody] AiRequest request)
        {
            var anthropicKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY") ?? _configuration["Anthropic:ApiKey"];
            var geminiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY") ?? _configuration["Gemini:ApiKey"];
            var groqKey = Environment.GetEnvironmentVariable("GROQ_API_KEY") ?? _configuration["Groq:ApiKey"];

            if (!string.IsNullOrEmpty(anthropicKey))
            {
                return await CallAnthropic(request, anthropicKey);
            }
            else if (!string.IsNullOrEmpty(geminiKey))
            {
                return await CallGemini(request, geminiKey);
            }
            else if (!string.IsNullOrEmpty(groqKey))
            {
                return await CallGroq(request, groqKey);
            }
            else
            {
                return Ok(new { content = new[] { new { text = "⚠️ AI API Key is missing. Please set ANTHROPIC_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY in the backend `.env` file to enable the AI Analyst." } } });
            }
        }

        private async Task<IActionResult> CallAnthropic(AiRequest request, string apiKey)
        {
            var anthropicRequest = new
            {
                model = "claude-3-haiku-20240307", // use faster model if specified model not found or just hardcode
                max_tokens = request.max_tokens ?? 1000,
                system = request.system,
                messages = request.messages
            };

            var content = new StringContent(JsonSerializer.Serialize(anthropicRequest), Encoding.UTF8, "application/json");
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("x-api-key", apiKey);
            _httpClient.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

            var response = await _httpClient.PostAsync("https://api.anthropic.com/v1/messages", content);
            var responseString = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var doc = JsonDocument.Parse(responseString);
                return Ok(doc.RootElement);
            }
            
            // On error, return as a chat message anyway for graceful frontend handling
            return Ok(new { content = new[] { new { text = $"Error from Anthropic: {responseString}" } } });
        }

        private async Task<IActionResult> CallGemini(AiRequest request, string apiKey)
        {
            string systemPrompt = request.system ?? "";
            
            var contents = new List<object>();
            if (request.messages != null)
            {
                foreach (var msg in request.messages)
                {
                    contents.Add(new
                    {
                        role = msg.role == "user" ? "user" : "model",
                        parts = new[] { new { text = msg.content } }
                    });
                }
            }

            var geminiUrl = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";
            var geminiRequest = new
            {
                systemInstruction = new { parts = new[] { new { text = systemPrompt } } },
                contents = contents
            };

            var content = new StringContent(JsonSerializer.Serialize(geminiRequest), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(geminiUrl, content);
            var responseString = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                try
                {
                    var doc = JsonDocument.Parse(responseString);
                    var text = doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
                    return Ok(new { content = new[] { new { text = text } } });
                }
                catch (Exception)
                {
                    return Ok(new { content = new[] { new { text = "Failed to parse Gemini response." } } });
                }
            }
            
            return Ok(new { content = new[] { new { text = $"Error from Gemini: {responseString}" } } });
        }

        private async Task<IActionResult> CallGroq(AiRequest request, string apiKey)
        {
            var messages = new List<object>();
            if (!string.IsNullOrEmpty(request.system))
            {
                messages.Add(new { role = "system", content = request.system });
            }
            if (request.messages != null)
            {
                foreach (var msg in request.messages)
                {
                    messages.Add(new { role = msg.role, content = msg.content });
                }
            }

            var groqRequest = new
            {
                model = "llama-3.3-70b-versatile", // Fast model on Groq
                messages = messages,
                max_tokens = request.max_tokens ?? 1000
            };

            var content = new StringContent(JsonSerializer.Serialize(groqRequest), Encoding.UTF8, "application/json");
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            var response = await _httpClient.PostAsync("https://api.groq.com/openai/v1/chat/completions", content);
            var responseString = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                try
                {
                    var doc = JsonDocument.Parse(responseString);
                    var text = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
                    return Ok(new { content = new[] { new { text = text } } });
                }
                catch (Exception)
                {
                    return Ok(new { content = new[] { new { text = "Failed to parse Groq response." } } });
                }
            }
            
            return Ok(new { content = new[] { new { text = $"Error from Groq: {responseString}" } } });
        }
    }

    public class AiRequest
    {
        public string? model { get; set; }
        public int? max_tokens { get; set; }
        public string? system { get; set; }
        public List<AiMessage>? messages { get; set; }
    }

    public class AiMessage
    {
        public string role { get; set; } = "";
        public string content { get; set; } = "";
    }
}
