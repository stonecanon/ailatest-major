import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

const readJson = async (name) =>
  JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));

const majors = [
  ...(await readJson("majors.json")),
  ...(await readJson("major_expansion.json"))
];
const universities = await readJson("universities.json");
const universityMajors = await readJson("university_majors.json");
const admissionPlans = await readJson("admission_plans.json");
const admissionScores = await readJson("admission_scores.json");
const topics = await readJson("topics.json");
const comparisons = await readJson("comparisons.json");
const transferPolicies = await readJson("transfer_policies.json");
const sharePages = await readJson("share_pages.json");
const promoPages = await readJson("promo_pages.json");
const careerProfiles = await readJson("career_profiles.json");
const adviceProfiles = await readJson("advice_profiles.json");
const majorDecisionTags = await readJson("major_decision_tags.json");
const universityRecommendationEligibility = await readJson("university_recommendation_eligibility.json");
const doubleFirstClass = await readJson("double_first_class.json");
const universityRankings = await readJson("university_rankings.json");
const subjectEvaluations = await readJson("subject_evaluations.json");

const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

const unique = (items, key, label) => {
  const seen = new Set();
  for (const item of items) {
    if (!item[key]) fail(`${label} missing ${key}: ${JSON.stringify(item)}`);
    if (seen.has(item[key])) fail(`${label} duplicate ${key}: ${item[key]}`);
    seen.add(item[key]);
  }
};

unique(majors, "id", "major");
unique(majors, "slug", "major");
unique(majors, "code", "major");
unique(universities, "id", "university");
unique(universities, "slug", "university");

for (const university of universities) {
  if (university.admission_charter_url && !String(university.admission_charter_url).startsWith("https://gaokao.chsi.com.cn/")) {
    fail(`university ${university.slug} admission_charter_url must be a CHSI/Yangguang Gaokao URL`);
  }
  if (university.source_urls && !Array.isArray(university.source_urls)) {
    fail(`university ${university.slug} source_urls must be an array`);
  }
}

const majorIds = new Set(majors.map((major) => major.id));
const majorSlugs = new Set(majors.map((major) => major.slug));
const universityIds = new Set(universities.map((university) => university.id));
const allowedScoreGrains = new Set(["major", "major_group", "university_major_group", "university"]);

for (const major of majors) {
  if (!major.source_note) fail(`major ${major.slug} missing source_note`);
  if (major.faq_json && !Array.isArray(major.faq_json)) {
    fail(`major ${major.slug} faq_json must be an array`);
  }
  const hasAiContent = Boolean(major.description || major.ai_summary || (major.core_courses || []).length);
  if (hasAiContent && major.faq_json && major.faq_json.some((item) => !item.q || !item.a)) {
    fail(`major ${major.slug} has invalid FAQ item`);
  }
}

for (const link of universityMajors) {
  if (!universityIds.has(link.university_id)) fail(`university_major ${link.id} has unknown university_id`);
  if (!majorIds.has(link.major_id)) fail(`university_major ${link.id} has unknown major_id`);
  if (!link.source_note) fail(`university_major ${link.id} missing source_note`);
}

for (const plan of admissionPlans) {
  if (!universityIds.has(plan.university_id)) fail(`admission_plan ${plan.id} has unknown university_id`);
  if (!majorIds.has(plan.major_id)) fail(`admission_plan ${plan.id} has unknown major_id`);
  if (!plan.year || !plan.province) fail(`admission_plan ${plan.id} missing year/province`);
  if (!plan.source_note) fail(`admission_plan ${plan.id} missing source_note`);
}

for (const score of admissionScores) {
  if (!universityIds.has(score.university_id)) fail(`admission_score ${score.id} has unknown university_id`);
  const dataGrain = score.data_grain || "major";
  if (!allowedScoreGrains.has(dataGrain)) fail(`admission_score ${score.id} has invalid data_grain`);
  if (score.major_id && !majorIds.has(score.major_id)) fail(`admission_score ${score.id} has unknown major_id`);
  if (dataGrain === "major" && !majorIds.has(score.major_id)) {
    fail(`admission_score ${score.id} is major-grain but missing known major_id`);
  }
  if (dataGrain !== "major" && !score.major_group_code && !score.major_group_name && !score.subject_group) {
    fail(`admission_score ${score.id} is group-grain but missing group label`);
  }
  if (!score.year || !score.province) fail(`admission_score ${score.id} missing year/province`);
  if (score.min_rank !== null && score.min_rank !== undefined && Number(score.min_rank) <= 0) {
    fail(`admission_score ${score.id} has invalid min_rank`);
  }
  if (!score.source_note) fail(`admission_score ${score.id} missing source_note`);
}

for (const topic of topics) {
  for (const slug of topic.major_slugs) {
    if (!majorSlugs.has(slug)) fail(`topic ${topic.slug} references unknown major ${slug}`);
  }
}

for (const page of [...sharePages, ...promoPages]) {
  if (!page.slug || !page.title || !page.description) fail(`share page missing required text: ${JSON.stringify(page)}`);
  if (!page.source_note) fail(`share page ${page.slug} missing source_note`);
  for (const slug of page.major_slugs || []) {
    if (!majorSlugs.has(slug)) fail(`share page ${page.slug} references unknown major ${slug}`);
  }
}

for (const comparison of comparisons) {
  if (!majorSlugs.has(comparison.left)) fail(`comparison ${comparison.slug} unknown left major`);
  if (!majorSlugs.has(comparison.right)) fail(`comparison ${comparison.slug} unknown right major`);
}

unique(careerProfiles, "id", "career_profile");

for (const career of careerProfiles) {
  if (!majorIds.has(career.major_id)) fail(`career_profile ${career.id} has unknown major_id`);
  if (!career.occupation || !career.industry) fail(`career_profile ${career.id} missing occupation/industry`);
  if (!career.salary_level || !career.demand_trend || !career.ai_risk) {
    fail(`career_profile ${career.id} missing risk/trend fields`);
  }
  if (!career.source_note) fail(`career_profile ${career.id} missing source_note`);
}

unique(transferPolicies, "id", "transfer_policy");

for (const policy of transferPolicies) {
  if (!universityIds.has(policy.university_id)) fail(`transfer_policy ${policy.id} has unknown university_id`);
  if (!policy.difficulty_level) fail(`transfer_policy ${policy.id} missing difficulty_level`);
  if (Number(policy.openness_score) < 0 || Number(policy.openness_score) > 100) {
    fail(`transfer_policy ${policy.id} has invalid openness_score`);
  }
  if (!policy.summary || !policy.student_advice) fail(`transfer_policy ${policy.id} missing user-facing text`);
  if (!policy.source_note) fail(`transfer_policy ${policy.id} missing source_note`);
}

unique(adviceProfiles, "id", "advice_profile");

for (const advice of adviceProfiles) {
  if (!["major", "university"].includes(advice.target_type)) {
    fail(`advice_profile ${advice.id} has invalid target_type`);
  }
  if (!Array.isArray(advice.target_slugs) || !advice.target_slugs.length) {
    fail(`advice_profile ${advice.id} missing target_slugs`);
  }
  for (const slug of advice.target_slugs || []) {
    if (advice.target_type === "major" && !majorSlugs.has(slug)) {
      fail(`advice_profile ${advice.id} references unknown major ${slug}`);
    }
    if (advice.target_type === "university" && !universities.some((university) => university.slug === slug)) {
      fail(`advice_profile ${advice.id} references unknown university ${slug}`);
    }
  }
  if (!advice.title || !advice.summary) fail(`advice_profile ${advice.id} missing user-facing text`);
  if (!advice.source_note) fail(`advice_profile ${advice.id} missing source_note`);
}

unique(majorDecisionTags, "slug", "major_decision_tag");

for (const tag of majorDecisionTags) {
  if (!majorSlugs.has(tag.slug)) fail(`major_decision_tag references unknown major ${tag.slug}`);
  for (const key of ["civil_service_level", "civil_service_note", "work_scene", "gender_note", "family_decision", "public_opinion_note"]) {
    if (!tag[key]) fail(`major_decision_tag ${tag.slug} missing ${key}`);
  }
  if (tag.source_urls && !Array.isArray(tag.source_urls)) {
    fail(`major_decision_tag ${tag.slug} source_urls must be an array`);
  }
}

unique(universityRecommendationEligibility, "id", "university_recommendation_eligibility");
unique(universityRecommendationEligibility, "university_id", "university_recommendation_eligibility");

for (const eligibility of universityRecommendationEligibility) {
  if (!universityIds.has(eligibility.university_id)) {
    fail(`university_recommendation_eligibility ${eligibility.id} has unknown university_id`);
  }
  for (const key of ["eligibility", "status", "basis", "student_note", "source_name", "source_url", "source_note"]) {
    if (!eligibility[key]) fail(`university_recommendation_eligibility ${eligibility.id} missing ${key}`);
  }
  if (eligibility.extra_source_urls && !Array.isArray(eligibility.extra_source_urls)) {
    fail(`university_recommendation_eligibility ${eligibility.id} extra_source_urls must be an array`);
  }
}

unique(doubleFirstClass, "id", "double_first_class");
unique(doubleFirstClass, "name", "double_first_class");

if (doubleFirstClass.length !== 147) {
  fail(`double_first_class expected 147 records, got ${doubleFirstClass.length}`);
}

for (const item of doubleFirstClass) {
  if (!item.second_round_category || !item.source_url || !item.source_note) {
    fail(`double_first_class ${item.name} missing source fields`);
  }
  if (!Array.isArray(item.disciplines)) {
    fail(`double_first_class ${item.name} disciplines must be an array`);
  }
  if (!item.disciplines.length && !item.discipline_note) {
    fail(`double_first_class ${item.name} missing disciplines or discipline_note`);
  }
  if (item.aliases && !Array.isArray(item.aliases)) {
    fail(`double_first_class ${item.name} aliases must be an array`);
  }
}

unique(universityRankings, "name", "university_ranking");

const universityNames = new Set(universities.map((university) => university.name));
for (const item of universityRankings) {
  if (!universityNames.has(item.name)) fail(`university_ranking references unknown university ${item.name}`);
  if (!item.rankings || typeof item.rankings !== "object") fail(`university_ranking ${item.name} missing rankings`);
  if (!item.source_note || !Array.isArray(item.source_urls) || !item.source_urls.length) {
    fail(`university_ranking ${item.name} missing source fields`);
  }
}

unique(subjectEvaluations, "subject_code", "subject_evaluation");

for (const item of subjectEvaluations) {
  if (!item.subject_name || !item.round || !item.source_url || !item.source_note) {
    fail(`subject_evaluation ${item.subject_code} missing source/name fields`);
  }
  if (!Array.isArray(item.related_major_slugs) || !item.related_major_slugs.length) {
    fail(`subject_evaluation ${item.subject_code} missing related majors`);
  }
  for (const slug of item.related_major_slugs) {
    if (!majorSlugs.has(slug)) fail(`subject_evaluation ${item.subject_code} references unknown major ${slug}`);
  }
  if (!Array.isArray(item.results) || !item.results.length) {
    fail(`subject_evaluation ${item.subject_code} missing results`);
  }
  for (const result of item.results) {
    if (!result.grade || !Array.isArray(result.universities) || !result.universities.length) {
      fail(`subject_evaluation ${item.subject_code} has invalid result row`);
    }
  }
}

if (!process.exitCode) {
  console.log(`Data check passed: ${majors.length} majors, ${universities.length} universities.`);
}
