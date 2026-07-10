import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return NextResponse.json({ error: 'No auth' }, { status: 401 });

    const { type, lat, lng, recorded_at } = await request.json();
    const point = `POINT(${lng} ${lat})`;

    // 1. Guardar en BD respetando la hora original de fichaje (recorded_at)
    const { data: log, error: dbError } = await supabase
      .from('time_logs')
      .insert({
        user_id: session.user.id,
        type: type,
        location: point,
        recorded_at: recorded_at 
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 2. Ejecución asíncrona LLM (no bloquea el return)
    const runLLM = async () => {
      try {
        const completion = await openai.chat.completions.create({
          messages: [{ role: "system", content: `Auditor de RRHH. Fichaje ${type} a las ${recorded_at}. Coordenadas: ${lat}, ${lng}. Sede: 40.4167, -3.7032. Responde JSON {"is_anomaly": boolean, "notes": "razón breve"}.` }],
          model: "gpt-4o-mini",
          response_format: { type: "json_object" }
        });
        
        const audit = JSON.parse(completion.choices[0].message.content || '{}');
        
        if (audit.is_anomaly) {
          // Requiere SUPABASE_SERVICE_ROLE_KEY en Vercel si las políticas RLS bloquean update de empleados
          await supabase.from('time_logs').update({ 
            llm_anomaly_flag: true, 
            llm_audit_notes: audit.notes 
          }).eq('id', log.id);
        }
      } catch (e) { console.error("Error LLM", e); }
    };
    
    // No usamos await aquí para que la respuesta al cliente sea inmediata
    runLLM();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
