import { DialogueLine } from "../engine/dialogue/DialogueSystem";

export const introLines: DialogueLine[] = [
  { speaker: "Archer", text: "Dispatch said screaming. Out here. Great." },
  {
    speaker: "Johnny",
    text: "Maybe it's, uh, a raccoon situation. Raccoons scream, right?",
  },
  { speaker: "Archer", text: "It's not a raccoon, kid. Grab the bag." },
  {
    speaker: "Johnny",
    text: "Right. Bag. I have the bag. This is fine.",
  },
];

export const philosophicalConversation: DialogueLine[] = [
  {
    speaker: "Archer",
    text: "You know how many houses like this I've walked into?",
  },
  { speaker: "Johnny", text: "Uh — a lot? Is the answer a lot?" },
  {
    speaker: "Archer",
    text: "Enough. You stop counting after the first hundred.",
  },
  {
    speaker: "Archer",
    text: "Funny thing about this job. You're never there for the good part of anyone's day.",
  },
  {
    speaker: "Johnny",
    text: "That's... kind of bleak, Archer.",
  },
  {
    speaker: "Archer",
    text: "It's not bleak. It's the job. Somebody's gotta be in the room when it gets bad. Might as well be somebody who cares whether they make it.",
  },
  {
    speaker: "Archer",
    text: "You care. I can tell. Don't let it get burned out of you.",
  },
  { speaker: "Johnny", text: "...Thanks, Archer." },
  { speaker: "Archer", text: "Don't make it weird. Let's go find our patient." },
];

export const patientFirstLines: DialogueLine[] = [
  { speaker: "Patient", text: "You shouldn't have come." },
  { speaker: "Patient", text: "He wants my blood." },
  { speaker: "Johnny", text: "Sir? Sir, can you hear me? We're EMTs, we're here to help." },
  { speaker: "Patient", text: "It calls to me. It has always called to me." },
  { speaker: "Archer", text: "Alright, easy. Let's get a look at you." },
  { speaker: "Patient", text: "You brought the young one. It likes the young ones." },
];

export const patientAssessLines: DialogueLine[] = [
  { speaker: "Johnny", text: "Pulse is fast. Really fast." },
  { speaker: "Patient", text: "They opened the door and never closed it." },
  { speaker: "Archer", text: "Pupils are blown. Could be a stroke, could be psych. Let's not diagnose him on the floor." },
  { speaker: "Patient", text: "It knows your name now. It knows both your names." },
  { speaker: "Johnny", text: "That's — okay, that's a normal thing for a confused patient to say. Totally normal." },
];

export const preparingTransportLines: DialogueLine[] = [
  { speaker: "Archer", text: "On three, we get him onto the stretcher. Support his neck." },
  { speaker: "Johnny", text: "Got it. One, two—" },
  { speaker: "Patient", text: "Don't let it get dark before we're out." },
  { speaker: "Archer", text: "Nobody's staying here after dark, pal. Believe that." },
];

export const clueJournalLines: DialogueLine[] = [
  {
    speaker: "Johnny",
    text: "'...the circle must be unbroken, or it will follow the blood home...' What the hell were these people doing?",
  },
];

export const cluePhotoLines: DialogueLine[] = [
  {
    speaker: "Johnny",
    text: "Old family photo. There's... there's a shape behind them in the trees. Probably just a shadow.",
  },
];

export const clueSymbolLines: DialogueLine[] = [
  {
    speaker: "Johnny",
    text: "Someone carved this into the wall. Over and over. I don't like this house, Archer.",
  },
  { speaker: "Archer", text: "Nobody asked you to like it. Keep moving." },
];

// ---------- Phase 2: extraction, escape, ambulance, transport, crash ----------

export const extractionStep1Lines: DialogueLine[] = [
  { speaker: "Johnny", text: "Sir, I need you to squeeze my hand if you can hear me." },
  { speaker: "Patient", text: "It's already listening. It doesn't need my hand." },
  { speaker: "Archer", text: "Responsive to pain, not to command. Note it and move on." },
];

export const extractionStep2Lines: DialogueLine[] = [
  { speaker: "Archer", text: "Straps across the chest and hips. Don't let him thrash off the edge." },
  { speaker: "Johnny", text: "Okay — okay, sir, this is just to keep you safe, alright?" },
  { speaker: "Patient", text: "Safe. That's a funny word for a man like you to use in here." },
];

export const extractionStep3Lines: DialogueLine[] = [
  { speaker: "Archer", text: "On three. One, two—" },
  { speaker: "Johnny", text: "Got him. God, he's lighter than he should be." },
  { speaker: "Patient", text: "It weighs more than I do. It's been riding me for years." },
];

export const escapeDoorSlamLines: DialogueLine[] = [
  { speaker: "Johnny", text: "Did — did that door just close by itself?" },
  { speaker: "Archer", text: "Wind. Old house, bad seals. Keep walking." },
];

export const escapeDistantSoundLines: DialogueLine[] = [
  { speaker: "Johnny", text: "That's the room we already cleared. Nobody's back there." },
  { speaker: "Archer", text: "Then it's not our problem. Eyes forward." },
];

export const escapeQuietLines: DialogueLine[] = [
  { speaker: "Johnny", text: "It got quiet. Too quiet. I don't like that either." },
];

export const escapePatientReactsLines: DialogueLine[] = [
  { speaker: "Patient", text: "It's right there. Can't you see it standing there?" },
  { speaker: "Johnny", text: "There's nothing there, sir. There's nothing—" },
  { speaker: "Archer", text: "Johnny. Door. Now." },
];

export const exitHouseLines: DialogueLine[] = [
  { speaker: "Archer", text: "Outside. Finally. Get him loaded, I'll bring the truck around back." },
  { speaker: "Johnny", text: "Never thought I'd be this happy to see a parking lot." },
];

export const loadAmbulanceLines: DialogueLine[] = [
  { speaker: "Archer", text: "Stretcher locks into the mount. Make sure you hear it click." },
  { speaker: "Johnny", text: "Clicked. We're good." },
  { speaker: "Archer", text: "Get in back with him. I'll drive. Twelve minutes to the hospital." },
];

export const ambulanceInteriorIntroLines: DialogueLine[] = [
  { speaker: "Archer", text: "Buckle up, kid. And holler if his numbers do something stupid." },
  { speaker: "Johnny", text: "Define 'stupid.'" },
  { speaker: "Archer", text: "You'll know it when you see it." },
];

export const transportCalmLines: DialogueLine[] = [
  { speaker: "Johnny", text: "Vitals are stable. He's just... murmuring. That's normal for him at this point, I guess." },
  { speaker: "Patient", text: "It calls to me." },
];

export const transportRisingLines1: DialogueLine[] = [
  { speaker: "Johnny", text: "Heart rate's climbing. One-ten and rising." },
  { speaker: "Patient", text: "He wants my blood." },
  { speaker: "Archer", text: "Keep an eye on it. Probably anxiety. Probably." },
];

export const transportRisingLines2: DialogueLine[] = [
  { speaker: "Johnny", text: "Archer, the radio's doing something weird." },
  { speaker: "Archer", text: "It does that out here. Dead zone." },
  { speaker: "Patient", text: "Don't let it hear you." },
];

export const transportWindLines: DialogueLine[] = [
  { speaker: "Johnny", text: "Do you hear that? That's not the road." },
  { speaker: "Archer", text: "I hear wind, Johnny. It's a windy night." },
  { speaker: "Patient", text: "He's outside." },
];

export const transportPeakLines: DialogueLine[] = [
  { speaker: "Johnny", text: "Heart rate's one-fifty. Archer, something is wrong with him—" },
  { speaker: "Patient", text: "No... no, no, no—" },
  { speaker: "Johnny", text: "Archer, I see something out the back window—" },
  { speaker: "Archer", text: "Hold onto something—" },
];

export const crashAftermathLines: DialogueLine[] = [
  { speaker: "Johnny", text: "...Archer? Archer, are you—" },
];
