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
