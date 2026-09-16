using System.Security.Cryptography;
using System.Text;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Requests;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Gmail.v1;
using Google.Apis.Services;

namespace FinanzasAR.Vencimientos.API.Infrastructure.Gmail;

// Maneja el flujo OAuth2 de Google (scope gmail.readonly) y construye el GmailService.
// El parámetro `state` lleva el userId firmado con HMAC para asociar el callback.
public class GoogleOAuthService
{
    private readonly GoogleAuthorizationCodeFlow _flow;
    private readonly string _redirectUri;
    private readonly byte[] _hmacKey;

    public GoogleOAuthService(string clientId, string clientSecret, string redirectUri, string hmacKey)
    {
        _flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets { ClientId = clientId, ClientSecret = clientSecret },
            Scopes = new[] { GmailService.Scope.GmailReadonly }
        });
        _redirectUri = redirectUri;
        _hmacKey = Encoding.UTF8.GetBytes(hmacKey);
    }

    public string BuildAuthUrl(Guid userId)
    {
        var req = (GoogleAuthorizationCodeRequestUrl)_flow.CreateAuthorizationCodeRequest(_redirectUri);
        req.AccessType = "offline";   // necesario para recibir refresh_token
        req.Prompt = "consent";       // fuerza consent → siempre devuelve refresh_token
        req.State = SignState(userId);
        return req.Build().ToString();
    }

    public Task<TokenResponse> ExchangeAsync(string code, CancellationToken ct) =>
        _flow.ExchangeCodeForTokenAsync("user", code, _redirectUri, ct);

    public GmailService BuildGmailService(string refreshToken)
    {
        var token = new TokenResponse { RefreshToken = refreshToken };
        var credential = new UserCredential(_flow, "user", token); // auto-refresca el access_token
        return new GmailService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "FinanzasAR"
        });
    }

    // --- state firmado: "<userIdN>.<expUnix>.<hmac>" ---

    public string SignState(Guid userId)
    {
        var u = userId.ToString("N");
        var exp = DateTimeOffset.UtcNow.AddMinutes(15).ToUnixTimeSeconds();
        return $"{u}.{exp}.{Sign($"{u}.{exp}")}";
    }

    public bool TryReadState(string? state, out Guid userId)
    {
        userId = Guid.Empty;
        if (string.IsNullOrEmpty(state)) return false;
        var parts = state.Split('.');
        if (parts.Length != 3) return false;
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(Sign($"{parts[0]}.{parts[1]}")),
                Encoding.UTF8.GetBytes(parts[2]))) return false;
        if (!long.TryParse(parts[1], out var exp)) return false;
        if (DateTimeOffset.FromUnixTimeSeconds(exp) < DateTimeOffset.UtcNow) return false;
        return Guid.TryParseExact(parts[0], "N", out userId);
    }

    private string Sign(string data)
    {
        using var h = new HMACSHA256(_hmacKey);
        return Convert.ToBase64String(h.ComputeHash(Encoding.UTF8.GetBytes(data)))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}
