// Las subcategorías que pertenecen al Registro Médico PR, no al directorio del Mapa.
//
// Fuente única a propósito. Vivía copiada dentro de api/sitemap.ts, y el segundo
// consumidor (llms-full.txt) nunca recibió el filtro: pedía places sin filtrar,
// cortaba en 10,000 y anunciaba "Directorio Completo de Cabo Rojo" con 28% de una
// tabla que hoy son 35,757 publicados, casi toda médicos del NPPES de todo PR.
// Es el mismo corte que ya se había arreglado en el sitemap del Mapa el 9 ago 2026.
// Copiar la lista otra vez habría sido programar el próximo drift, así que sale aquí.
export const SPECIALIST_SUBS = ['cardiólogo','psiquiatra','fisiatra','ginecólogo','pediatra','dermatólogo','gastroenterólogo','oftalmólogo','ortopeda','neurólogo','urólogo','endocrinólogo','nefrólogo','neumólogo','oncólogo','reumatólogo','geriatra','otorrinolaringólogo','infectólogo','alergista','medicina de emergencia','cirujano general','anestesiólogo','radiólogo','neurocirujano','cirujano plástico','cirujano torácico','coloproctólogo','manejo de dolor','psicólogo','optómetra','podiatra','dentista','internista','medicina de familia','generalista','va','terapeuta del habla','terapista físico','terapista ocupacional','quiropráctico','consejero','trabajador social','terapeuta de familia','nutricionista','physician assistant','enfermera practicante','audiólogo','partera','farmacéutico','hospital','cuidado en el hogar','hospicio','hogar de envejecientes','centro de diálisis','urgent care','clínica comunitaria','laboratorio clínico','radiología','ambulancia','dentista pediátrico','ortodoncista','cirujano oral','naturópata','acupunturista','neonatólogo','cirujano vascular','patólogo','medicina ocupacional','hospitalista','medicina nuclear','genetista'];

// Formato PostgREST para `not('subcategory','in', ...)`. Las comillas dobles son
// obligatorias: hay valores con espacios ("medicina de emergencia") y con acento.
export const SUBS_IN_LIST = `(${SPECIALIST_SUBS.map((s) => `"${s}"`).join(',')})`;
