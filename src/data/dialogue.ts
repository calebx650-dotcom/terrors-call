import { DialogueLine } from "../engine/dialogue/DialogueSystem";

/**
 * Terror's Call demo script — Marcus Reyes, solo EMT-B, 2:47 AM.
 *
 * Per the brief: minimal voice. Marcus mutters protocol and short
 * observations; dispatch is clipped and procedural; the caller is a
 * fragment; the Patient almost never speaks. The player should spend more
 * time listening than talking, so most of these sets are two or three
 * short lines.
 */

export const dispatchIntroLines: DialogueLine[] = [
  {
    speaker: "Dispatch",
    text: "County, Medic 4. Respond — male, mid-40s, difficulty breathing, possible cardiac. 1140 Keller Farm Road.",
  },
  {
    speaker: "Dispatch",
    text: "Caller is female, on scene. Relay is breaking up — [static] — copy her last?",
  },
  {
    speaker: "Caller",
    text: "—he's on the floor, he's not— please, he's still—",
    duration: 3.5,
  },
  { speaker: "Dispatch", text: "Caller disconnected. Medic 4, you're responding alone tonight. Copy." },
  { speaker: "Marcus", text: "Copy. Responding. Of course I'm alone." },
];

export const arrivalLines: DialogueLine[] = [
  { speaker: "Marcus", text: "No porch light. No caller waiting outside. Great." },
  { speaker: "Marcus", text: "Scene safety, Reyes. Same as every call." },
];

export const sceneSafetyLines: DialogueLine[] = [
  { speaker: "Marcus", text: "County EMS! Anyone home? Your door's open—" },
  { speaker: "Marcus", text: "...Power's out. House is quiet. Scene is... fine. It's fine." },
];

export const patientFoundLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Okay — male, forties, supine on the floor. Matches dispatch." },
  { speaker: "Marcus", text: "Where's the woman who called it in?" },
];

export const responsivenessLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Sir? Sir, County EMS. Can you hear me?" },
  { speaker: "Marcus", text: "...Nothing on voice. Trying painful stimulus." },
  { speaker: "Marcus", text: "That was a response. I think that was a response." },
];

export const airwayLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Airway's clear. No obstruction." },
  { speaker: "Marcus", text: "Chest is moving, but the rhythm's... he holds it too long. People don't breathe like that." },
];

export const pulseAfterLines: DialogueLine[] = [
  { speaker: "Marcus", text: "...There. Carotid's there. Slow." },
  { speaker: "Marcus", text: "It felt like it was matching mine. That's — no. Write it down and move on." },
];

export const pupilsLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Pupils fixed and dilated. Both sides." },
  { speaker: "Marcus", text: "That doesn't fit. Fixed and dilated, but he responds to pain? That doesn't fit anything." },
];

export const pupilsWrongLines: DialogueLine[] = [
  { speaker: "Marcus", text: "They moved. Not at my light — at something behind me." },
];

export const vitalsLines: DialogueLine[] = [
  { speaker: "Marcus", text: "BP one-ten palp. Pulse fifty-two. Resp... eight. Skin cold." },
  { speaker: "Marcus", text: "Cold isn't right either. Nothing on this sheet is right." },
];

export const assessmentDoneLines: DialogueLine[] = [
  { speaker: "Marcus", text: "I can't move him alone and I can't leave him. I need the caller, a phone, anything." },
];

// ---------- investigation ----------

export const phoneLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Line's dead. Not storm-dead. Cut-off-months-ago dead." },
  { speaker: "Marcus", text: "Then who called 911 tonight?" },
];

export const medsLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Digoxin. Last refill... March. Seven months of dust on the cap." },
];

export const kitchenNoteLines: DialogueLine[] = [
  {
    speaker: "Marcus",
    text: "A grocery list. Milk, bread, batteries. The handwriting falls apart halfway down, like the pen kept moving after the words stopped.",
  },
];

export const photosFirstLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Family photos. Him, a woman, a kid. Ordinary." },
];

export const photosSecondLines: DialogueLine[] = [
  { speaker: "Marcus", text: "...Wasn't there a woman in this one?" },
];

export const photosThirdLines: DialogueLine[] = [
  { speaker: "Marcus", text: "No. No, I'm not in that photograph. I'm not looking at it again." },
];

export const bathroomKeyLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Medicine cabinet. A key — masking tape says 'BEDROOM — D.'" },
];

export const bathroomMirrorLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Mirror's fogged. The house is stone cold, and the mirror is fogged." },
];

// ---------- midpoint ----------

export const previousPcrLines: DialogueLine[] = [
  { speaker: "Marcus", text: "PCR forms. Three of them. County format — these are ours." },
  { speaker: "Marcus", text: "Unit 2, Tuesday. Unit 7, Wednesday. Unit 3... yesterday." },
  { speaker: "Marcus", text: "BP one-ten palp. Pulse fifty-two. Resp eight. All three sheets. Identical." },
  { speaker: "Marcus", text: "Those are my numbers. Those are the numbers I just wrote down." },
  { speaker: "Marcus", text: "None of them are complete. They all stop at the same line." },
];

export const stalkingStartLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Okay. He was on the floor. He was just on the floor." },
];

export const stalkingBark1: DialogueLine[] = [
  { speaker: "Marcus", text: "Don't look away from it. It only moves when you look away." },
];

export const stalkingBark2: DialogueLine[] = [
  { speaker: "Marcus", text: "Keep it together, Reyes. Finish the call. Or don't. Nobody else did." },
];

// ---------- upstairs ----------

export const bedroomLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Dust on everything. Nobody's slept here in months." },
  {
    speaker: "Marcus",
    text: "Funeral pamphlet on the dresser. Eleanor. His wife. Two years ago.",
  },
  { speaker: "Marcus", text: "The caller was a woman." },
];

export const bedroomExitLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Something moved downstairs. Heavy. Below the kitchen." },
];

// ---------- basement ----------

export const basementDoorLines: DialogueLine[] = [
  { speaker: "Marcus", text: "This door was swollen shut ten minutes ago." },
];

export const basementBodyLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Oh. Oh, no." },
  { speaker: "Marcus", text: "Male, mid-forties. Same build. Same face.", duration: 3.5 },
  { speaker: "Marcus", text: "He's been down here days. Three, maybe more." },
  { speaker: "Marcus", text: "Then what have I been assessing upstairs?" },
];

// ---------- radio ----------

export const radioTellLines: DialogueLine[] = [
  { speaker: "Marcus", text: "Dispatch, Medic 4. I need law enforcement at my location—" },
  { speaker: "Dispatch", text: "Medic 4, copy. [static] Confirm you're staying clear of the basement." },
  { speaker: "Marcus", text: "...Dispatch, I never said anything about a basement." },
  { speaker: "Dispatch", text: "[dead air]", duration: 3 },
];

export const endingChoiceLines: DialogueLine[] = [
  { speaker: "Marcus", text: "The patient's still up there. It's still up there, waiting for me to come back and try again." },
];

// ---------- endings ----------

export const endingALines: DialogueLine[] = [
  { speaker: "Marcus", text: "Dispatch, Medic 4. Patient is DOA. Three days. I'm clearing the scene." },
  { speaker: "Dispatch", text: "[static] ...Medic 4, confirm patient status?" },
  { speaker: "Marcus", text: "I said he's gone. I'm coming home." },
  { speaker: "Dispatch", text: "[static] ...Copy, Medic 4. Drive safe. He knows the way.", duration: 4 },
];

export const endingBLines: DialogueLine[] = [
  { speaker: "Marcus", text: "One more assessment. If there's any chance he's alive up there, I have to." },
  { speaker: "Marcus", text: "That's the job. Somebody has to keep trying." },
];

export const patientWhisper: DialogueLine[] = [
  { speaker: "Patient", text: "(a whisper, too close) ...again...", duration: 2.5 },
];
