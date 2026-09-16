using System.Security.Cryptography;
using System.Text;

namespace FinanzasAR.Vencimientos.API.Infrastructure.Security;

// Cifra/descifra el refresh_token de Gmail con AES-256-GCM.
// Formato de salida (base64): [nonce(12)] [tag(16)] [ciphertext].
public class TokenCipher
{
    private readonly byte[] _key;

    public TokenCipher(string base64Key)
    {
        _key = Convert.FromBase64String(base64Key);
        if (_key.Length != 32)
            throw new ArgumentException("ENCRYPTION_KEY debe ser de 32 bytes codificados en base64.");
    }

    public string Encrypt(string plaintext)
    {
        var plain = Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];

        using var aes = new AesGcm(_key, 16);
        aes.Encrypt(nonce, plain, cipher, tag);

        var combined = new byte[12 + 16 + cipher.Length];
        Buffer.BlockCopy(nonce, 0, combined, 0, 12);
        Buffer.BlockCopy(tag, 0, combined, 12, 16);
        Buffer.BlockCopy(cipher, 0, combined, 28, cipher.Length);
        return Convert.ToBase64String(combined);
    }

    public string Decrypt(string encoded)
    {
        var combined = Convert.FromBase64String(encoded);
        var nonce = combined[..12];
        var tag = combined[12..28];
        var cipher = combined[28..];
        var plain = new byte[cipher.Length];

        using var aes = new AesGcm(_key, 16);
        aes.Decrypt(nonce, cipher, tag, plain);
        return Encoding.UTF8.GetString(plain);
    }
}
