import { AudioClip, Concept, Keyword, Kit, ListeningItem, PracticeStory, Question } from "@triveni/core";
import audioJson from "../data/audio.json";
import conceptsJson from "../data/concepts.json";
import keywordsJson from "../data/keywords.json";
import kitsJson from "../data/kits.json";
import listeningJson from "../data/listening.json";
import questionsJson from "../data/questions.json";
import storiesJson from "../data/stories.json";

export const audioClips = AudioClip.array().parse(audioJson);
export const concepts = Concept.array().parse(conceptsJson);
export const keywords = Keyword.array().parse(keywordsJson);
export const questions = Question.array().parse(questionsJson);
export const stories = PracticeStory.array().parse(storiesJson);
// Empty until Stage 19 writes them.
export const kits = Kit.array().parse(kitsJson);
export const listeningItems = ListeningItem.array().parse(listeningJson);
