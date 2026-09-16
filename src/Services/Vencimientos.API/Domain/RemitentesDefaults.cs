namespace FinanzasAR.Vencimientos.API.Domain;

// Remitentes sugeridos al usuario al conectar Gmail (servicios e impuestos comunes en Argentina).
public static class RemitentesDefaults
{
    public static readonly (string Email, string Empresa)[] Lista =
    [
        ("facturas@edenor.com", "Edenor"),
        ("noreply@metrogas.com.ar", "Metrogas"),
        ("noreply@personal.com.ar", "Personal"),
        ("facturacion@movistar.com.ar", "Movistar"),
        ("resumen@galicia.com.ar", "Banco Galicia"),
        ("extracto@santander.com.ar", "Santander"),
        ("resumen@bbva.com.ar", "BBVA"),
        ("no-reply@mercadopago.com", "Mercado Pago"),
        ("facturacion@osde.com.ar", "OSDE"),
        ("noreply@fibertel.com.ar", "Fibertel"),
        ("avisos@claro.com.ar", "Claro")
    ];
}
