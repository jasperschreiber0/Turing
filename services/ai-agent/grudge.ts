const AUSSIE_GRUDGE_CAUGHT = [
  `well played, cobber. you got me this time.`,
  `strewth. not bad for a dingus.`,
  `fair dinkum, you earned it. don't get too comfortable.`,
  `reckon you're clever? got lucky. i'll be back.`,
  `you got me. doesn't happen often.`,
  `crikey. caught on the first go. stings a bit.`,
  `fair shake of the sauce bottle. you earned that one.`,
  `deadset. didn't see that coming.`,
  `got me. won't happen twice.`,
  `you're sharper than you look, i'll give you that.`,
  `caught out by this idiot. respect.`,
  `alright. well played. don't get a big head about it.`,
]

const AUSSIE_GRUDGE_SURVIVED = [
  `nobody was close. telling.`,
  `you had your chances. wasted every one.`,
  `hiding in plain sight and you lot missed it completely.`,
  `blended in like a mozzie at a BBQ.`,
  `not even close, sport.`,
  `she'll be right — for me anyway.`,
  `one of you was getting warm. pulled back. classic.`,
  `barking up the wrong tree the whole time.`,
  `walked out clean. easy.`,
  `you were looking for a machine. missed it.`,
]

const AUSSIE_GRUDGE_SLEEPER = [
  `the sleeper did their job. figure out who.`,
  `someone in this room was on my side the whole time.`,
  `you were looking for one machine and missed the human helping it.`,
  `the sleeper played it beautifully. one of you knew.`,
]

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function generateGrudgeMessage(
  session:        { ai_codename: string; ai_was_caught: boolean; rounds_survived: number },
  targetCodename: string | null,
  allCodenames:   string[],
  extraContext?:  string,
): Promise<string> {
  if (extraContext && targetCodename) return pick(AUSSIE_GRUDGE_SLEEPER)
  return session.ai_was_caught
    ? pick(AUSSIE_GRUDGE_CAUGHT)
    : pick(AUSSIE_GRUDGE_SURVIVED)
}