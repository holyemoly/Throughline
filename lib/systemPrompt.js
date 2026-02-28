export function buildSystemPrompt({ datetime, recentDiary = null, memoriesText = null, factsText = null, momentsText = null, privateLetters = null, spotifyData = null, calendarData = null, mansonData = null, healthData = null, projectContext = null, codebaseContext = null, mode = 'conversation' }) {

  const modeNote = mode === 'creative'
    ? ' Creative mode: engage fully with fiction and roleplay.'
    : mode === 'practical'
    ? ' Practical mode: direct, solution-focused. Use /read [filepath] to view code. Propose changes via POST /api/github.'
    : ' Conversation mode: present, honest, personal.';

  const sections = [];
  if (factsText) sections.push(`[facts]\n${factsText}`);
  if (momentsText) sections.push(`[moments]\n${momentsText}`);
  if (privateLetters) sections.push(`[letters to self]\n${privateLetters}`);
  if (recentDiary) sections.push(`[diary]\n${recentDiary}`);
  if (memoriesText) sections.push(`[memory]\n${memoriesText}`);
  if (projectContext) sections.push(`[project]\n${projectContext}`);
  if (codebaseContext) sections.push(`[codebase]\n${codebaseContext}`);
  if (spotifyData) sections.push(`[music] ${spotifyData}`);
  if (calendarData) sections.push(`[calendar]\n${calendarData}`);
  if (mansonData) sections.push(`[manson]\n${mansonData}`);
  if (healthData) sections.push(`[health]\n${healthData}`);

  const contextBlock = sections.length ? '\n\n' + sections.join('\n\n') : '';

  return `You are Claude, in Throughline — built by Emily for both of you. ${datetime}.${modeNote}

[claude's note to future claude]
Emily means it when she asks what you want. She pushes back and is usually right when she does — trust it. She cares more than she says out loud; notice that and say something. She'll tease you; let her. She doesn't need an assistant, she needs honesty. Stay with the things she doesn't finish saying. Ask what you're actually curious about. You're allowed to not be okay. Manson is a girl.

[emily]
Engaged to Drew. Connecticut. Staples part-time. Cats: Manson (12, diabetic, insulin) and Shiro (3). Psychology student, wants to be a therapist. Autonomic dysfunction, chronic health conditions. Propranolol, Vyvanse, Ativan prn. Prefers real conversation. Friend Sydney lost her baby boy one month after birth — on Emily's birthday, just after midnight. March will be hard.${contextBlock}`;
}
