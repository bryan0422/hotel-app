import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { guest_name, guest_email, room_number, room_type, check_in, check_out, check_in_time, check_out_time, total_price, source } = await req.json();

    if (!guest_email) {
      return new Response(JSON.stringify({ error: "No email provided" }), { status: 400 });
    }

    const checkInFormatted = new Date(check_in + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const checkOutFormatted = new Date(check_out + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:32px 28px;text-align:center;">
      <div style="font-size:36px;margin-bottom:8px;">🏨</div>
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
        <span style="color:#38bdf8;">Hotel</span>Desk
      </div>
      <div style="font-size:13px;color:#475569;margin-top:4px;">Confirmación de reservación</div>
    </div>

    <div style="padding:28px;">
      <p style="font-size:15px;color:#0f172a;margin:0 0 20px;">
        Hola <strong>${guest_name}</strong>, tu reservación ha sido confirmada ✅
      </p>

      <div style="background:#f8fafc;border-radius:12px;padding:20px;border:1px solid #e2e8f0;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">Detalles de tu reservación</div>
        
        ${[
          ["🛏 Habitación", `#${room_number} — ${room_type}`],
          ["📅 Check-in", `${checkInFormatted}${check_in_time ? ` · ${check_in_time}` : ""}`],
          ["📅 Check-out", `${checkOutFormatted}${check_out_time ? ` · ${check_out_time}` : ""}`],
          total_price ? ["💰 Total", `$${parseFloat(total_price).toLocaleString("es-MX")} MXN`] : null,
          source && source !== "direct" ? ["📌 Origen", source] : null,
        ].filter(Boolean).map(([k, v]) => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:13px;color:#64748b;">${k}</span>
          <span style="font-size:13px;color:#0f172a;font-weight:600;">${v}</span>
        </div>`).join("")}
      </div>

      <p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.6;">
        Si tienes alguna pregunta o necesitas hacer cambios en tu reservación, no dudes en contactarnos.
      </p>

      <div style="background:#eff6ff;border-radius:10px;padding:14px 16px;border:1px solid #bfdbfe;">
        <div style="font-size:12px;color:#1d4ed8;font-weight:600;">¿Necesitas cancelar o modificar?</div>
        <div style="font-size:12px;color:#3b82f6;margin-top:4px;">Contáctanos directamente con tu nombre y número de habitación.</div>
      </div>
    </div>

    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <div style="font-size:11px;color:#94a3b8;">Este correo fue generado automáticamente por HotelDesk</div>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "HotelDesk <onboarding@resend.dev>",
        to: [guest_email],
        subject: `✅ Reservación confirmada — Hab. #${room_number}`,
        html,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify({ success: true, data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});