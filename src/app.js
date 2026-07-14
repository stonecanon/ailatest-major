const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const normalizeFavoriteValues = (items = []) => items
  .map((item) => String(item || "").trim())
  .filter(Boolean)
  .map((item) => {
    const match = item.match(/\/(?:major|university)\/([^/]+)\/?/);
    return match ? match[1] : item;
  });

const readFavorites = () => {
  const legacyMajor = safeJsonParse(readStorage("majorai:favorites") || readStorage("openmajor:favorites"), []);
  const saved = safeJsonParse(readStorage("majorai:favorites:v2"), null);
  if (Array.isArray(saved)) {
    return { major: normalizeFavoriteValues(saved), university: [] };
  }
  return {
    major: normalizeFavoriteValues(Array.isArray(saved?.major) ? saved.major : Array.isArray(legacyMajor) ? legacyMajor : []),
    university: normalizeFavoriteValues(Array.isArray(saved?.university) ? saved.university : [])
  };
};

const state = {
  data: null,
  admissionScoresLoading: null,
  favorites: (() => {
    const saved = readFavorites();
    return {
      major: new Set(saved.major),
      university: new Set(saved.university)
    };
  })()
};

const ensureAdmissionScores = async () => {
  if (state.data?.admissionScores?.length) return state.data.admissionScores;
  if (!state.data) return [];
  if (!state.admissionScoresLoading) {
    state.admissionScoresLoading = fetch("/data/admission-scores.json")
      .then((response) => response.ok ? response.json() : [])
      .then((scores) => {
        state.data.admissionScores = Array.isArray(scores) ? scores : [];
        return state.data.admissionScores;
      })
      .catch(() => {
        state.data.admissionScores = [];
        return [];
      });
  }
  return state.admissionScoresLoading;
};

const saveFavorites = () => {
  return writeStorage("majorai:favorites:v2", JSON.stringify({
    major: [...state.favorites.major],
    university: [...state.favorites.university]
  }));
};

const favoriteSet = (type) => state.favorites[type] || state.favorites.major;

const normalize = (value) => String(value || "").toLowerCase();
const splitWords = (value) => String(value || "").split(/[,\s，、；;]+/).map((item) => item.trim()).filter(Boolean);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
})[char]);

const uniqueItems = (items = []) => [...new Set(items.filter(Boolean))];
const dataGrainLabel = (grain) => ({
  major: "单专业",
  major_group: "专业类/大类",
  university_major_group: "院校专业组",
  university: "院校级"
}[grain] || "未标注");

const getUniversityEligibility = (university) => {
  if (!university || !state.data) return null;
  return (state.data.universityRecommendationEligibility || []).find((item) => item.university_id === university.id) || null;
};

const universityDecisionTags = (university) => {
  if (!university) return [];
  const eligibility = getUniversityEligibility(university);
  return uniqueItems([
    ...(university.tags || []).filter((tag) => ["985", "211", "双一流"].includes(tag) || /^首轮[AB]类$/.test(tag)),
    eligibility?.eligibility
  ]);
};

const renderUniversityDecisionTags = (university) => {
  const tags = universityDecisionTags(university);
  return tags.length
    ? `<span class="inline-tags decision-tags">${tags.map((tag) => `<span class="tag ${tag === "有推免资格" ? "tag-strong" : "tag-key"}">${escapeHtml(tag)}</span>`).join("")}</span>`
    : "";
};

const normalizeSubject = (value) => {
  const text = String(value || "").trim();
  if (/物/.test(text)) return "物理";
  if (/化/.test(text)) return "化学";
  if (/生/.test(text)) return "生物";
  if (/政|思想/.test(text)) return "政治";
  if (/史/.test(text)) return "历史";
  if (/地/.test(text)) return "地理";
  if (/技/.test(text)) return "技术";
  return text;
};

const parseSubjects = (values = []) => new Set(values.map(normalizeSubject).filter(Boolean));

const parseSubjectRequirement = (text) => {
  const value = String(text || "");
  if (/不限|不提科目|无选考/.test(value)) {
    return { type: "explicit", requiredAll: [], label: "不限" };
  }
  if (/物化|物理\s*[+＋、,，和及]\s*化学|物理.*化学|化学.*物理/.test(value)) {
    return { type: "explicit", requiredAll: ["物理", "化学"], label: "物理+化学" };
  }
  const subjects = ["物理", "化学", "生物", "政治", "历史", "地理", "技术"].filter((subject) => value.includes(subject));
  if (subjects.length) {
    return { type: "explicit", requiredAll: subjects, label: subjects.join("+") };
  }
  return null;
};

const isActionableSubjectRequirement = (text) => Boolean(parseSubjectRequirement(text));

const subjectRequirementWeight = (text) => {
  const value = String(text || "").trim();
  if (!value) return 0;
  return isActionableSubjectRequirement(value) ? 100 : 1;
};

const buildSubjectRequirementIndex = (siteData = {}) => {
  const index = new Map();
  const remember = (key, item) => {
    if (!key || !item?.text) return;
    const current = index.get(key);
    const nextScore = subjectRequirementWeight(item.text);
    const currentScore = subjectRequirementWeight(current?.text);
    if (!current || nextScore > currentScore || (nextScore === currentScore && Number(item.year || 0) > Number(current.year || 0))) {
      index.set(key, item);
    }
  };

  for (const link of siteData.universityMajors || []) {
    if (!link.university_id || !link.major_id) continue;
    const text = String(link.subject_requirements || "").trim();
    if (!text) continue;
    const item = { text, year: link.year, source: "招生录取" };
    remember(`${link.university_id}:${link.major_id}:${link.province || ""}`, item);
    remember(`${link.university_id}:${link.major_id}:`, item);
  }
  return index;
};

const findSubjectRequirement = (index, { universityId, majorId, province } = {}) => {
  if (!index || !universityId || !majorId) return null;
  return index.get(`${universityId}:${majorId}:${province || ""}`) || index.get(`${universityId}:${majorId}:`) || null;
};

const displaySubjectRequirement = (text) => {
  const parsed = parseSubjectRequirement(text);
  return parsed ? parsed.label : "需查招生计划";
};

const scoreSubjectRequirement = (score, subjectRequirementIndex) => {
  const matched = findSubjectRequirement(subjectRequirementIndex, {
    universityId: score.university_id,
    majorId: score.major_id,
    province: score.province
  });
  if (matched?.text && isActionableSubjectRequirement(matched.text)) return matched.text;
  if (isActionableSubjectRequirement(score.major_group_name)) return score.major_group_name;
  if (isActionableSubjectRequirement(score.subject_group)) return score.subject_group;
  return "";
};

const inferSubjectRequirement = (choice) => {
  const text = `${choice.major} ${choice.raw}`;
  if (/临床|口腔|麻醉|医学影像|儿科|精神医学|基础医学|预防医学|药学|中药|化学|化工|材料|生物|食品|环境|能源|计算机|软件|人工智能|智能|数据科学|电子|电气|自动化|机械|车辆|交通|航空|航天|机器人|集成电路|微电子|通信|网络空间|物联网|土木|测控/.test(text)) {
    return { type: "inferred", requiredAll: ["物理", "化学"], label: "常见要求：物理+化学" };
  }
  if (/建筑|城乡规划|风景园林|工业设计/.test(text)) {
    return { type: "inferred", requiredAny: ["物理"], label: "部分院校可能要求物理" };
  }
  if (/公安|侦查|治安|思想政治教育|马克思主义|政治学/.test(text)) {
    return { type: "inferred", requiredAny: ["政治"], label: "部分院校可能要求政治" };
  }
  return { type: "unknown", requiredAll: [], label: "需查当年招生计划" };
};

const checkSubjectFit = (choice, selectedSubjects, knownRequirement = "") => {
  const knownParsed = parseSubjectRequirement(knownRequirement);
  if (!selectedSubjects.size) {
    if (knownParsed) {
      return {
        status: "unknown",
        label: knownParsed.label,
        note: `已匹配招生录取中的选科要求：${knownParsed.label}；填写选考科目后可判断是否可报。`,
        source: "招生录取"
      };
    }
    return { status: "unknown", label: "未填选科", note: "未填写选考科目，无法判断是否可报。" };
  }
  const requirement = knownParsed || parseSubjectRequirement(choice.raw) || inferSubjectRequirement(choice);
  const requiredAll = requirement.requiredAll || [];
  const requiredAny = requirement.requiredAny || [];
  const missingAll = requiredAll.filter((subject) => !selectedSubjects.has(subject));
  const hasAny = !requiredAny.length || requiredAny.some((subject) => selectedSubjects.has(subject));

  if (missingAll.length || !hasAny) {
    const needed = missingAll.length ? missingAll.join("+") : requiredAny.join("或");
    return {
      status: requirement.type === "explicit" ? "blocked" : "warn",
      label: requirement.label,
      note: requirement.type === "explicit"
        ? `不符合已写明的选科要求，缺少：${needed}。`
        : `按常见要求初筛可能受限，需核对招生计划：${requirement.label}。`,
      source: knownParsed ? "招生录取" : ""
    };
  }

  if (requirement.type === "unknown") {
    return { status: "unknown", label: requirement.label, note: "未识别到明确选科要求，需以省考试院招生计划为准。" };
  }
  return {
    status: requirement.type === "explicit" ? "ok" : "soft-ok",
    label: requirement.label,
    note: requirement.type === "explicit" ? "符合已写明的选科要求。" : "按常见要求初筛未发现选科冲突。",
    source: knownParsed ? "招生录取" : ""
  };
};

const scoreMajor = (major, query) => {
  const haystack = [
    major.name,
    major.code,
    major.category,
    major.discipline,
    major.ai_summary,
    ...(major.core_courses || []),
    ...(major.career_directions || []),
    ...(major.fit_tags || [])
  ].join(" ");
  return normalize(haystack).includes(normalize(query)) ? 3 : 0;
};

const scoreUniversity = (university, query) => {
  const eligibility = (state.data?.universityRecommendationEligibility || []).find((item) => item.university_id === university.id);
  const doubleFirstClass = university.double_first_class;
  const haystack = [
    university.name,
    university.province,
    university.city,
    university.type,
    university.authority,
    ...(university.tags || []),
    doubleFirstClass?.second_round_category,
    doubleFirstClass?.first_round_class,
    doubleFirstClass?.first_round_note,
    doubleFirstClass?.discipline_note,
    ...(doubleFirstClass?.disciplines || []),
    eligibility?.eligibility,
    eligibility?.status,
    eligibility?.basis,
    eligibility?.student_note
  ].join(" ");
  return normalize(haystack).includes(normalize(query)) ? 2 : 0;
};

const renderSearch = (query) => {
  const target = document.querySelector("#search-results");
  if (!target || !state.data) return;
  const clean = query.trim();
  if (!clean) {
    target.innerHTML = "";
    return;
  }
  const majors = state.data.majors
    .map((major) => ({ type: "专业", title: major.name, href: `/major/${major.slug}/`, text: major.ai_summary, score: scoreMajor(major, clean) }))
    .filter((item) => item.score > 0);
  const universities = state.data.universities
    .map((university) => ({ type: "院校", title: university.name, href: `/university/${university.slug}/`, text: `${university.province}${university.city} · ${(university.tags || []).join(" · ")}`, score: scoreUniversity(university, clean) }))
    .filter((item) => item.score > 0);
  const results = [...majors, ...universities].sort((a, b) => b.score - a.score).slice(0, 10);
  target.innerHTML = results.length
    ? results.map((item) => `<a class="result" href="${item.href}"><span>${item.type}</span><strong>${item.title}</strong><small>${item.text}</small></a>`).join("")
    : `<p class="empty">暂未找到匹配结果。可以换一个专业名、院校名或职业方向。</p>`;
};

const setupSearch = () => {
  const input = document.querySelector("#search-input");
  const form = document.querySelector("#search");
  if (!input || !form) return;
  const params = new URLSearchParams(location.search);
  if (params.get("q")) {
    input.value = params.get("q");
    renderSearch(input.value);
  }
  input.addEventListener("input", () => renderSearch(input.value));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSearch(input.value);
    history.replaceState(null, "", input.value.trim() ? `/?q=${encodeURIComponent(input.value.trim())}` : "/");
  });
};

const librarySearchConfig = {
  major: {
    items: () => state.data.majors || [],
    score: scoreMajor,
    type: "专业",
    href: (item) => `/major/${item.slug}/`,
    text: (item) => item.ai_summary || `${item.discipline || ""} · ${item.category || ""}`,
    empty: "暂未找到匹配专业。可以换一个专业名、代码、课程或就业方向。"
  },
  university: {
    items: () => state.data.universities || [],
    score: scoreUniversity,
    type: "大学",
    href: (item) => `/university/${item.slug}/`,
    text: (item) => {
      const r = item.ranking?.rankings || {};
      const rankingLabels = [
        r.ruanke_2026_cn ? `软科${r.ruanke_2026_cn}` : r.ruanke_2025_cn ? `软科${r.ruanke_2025_cn}` : "",
        r.qs_2026_world ? `QS${r.qs_2026_world}` : r.qs_2025_world ? `QS${r.qs_2025_world}` : "",
        r.the_2026_cn ? `THE中国${r.the_2026_cn}` : "",
        r.the_2026_world ? `THE${r.the_2026_world}` : r.the_2026_world_range ? `THE${r.the_2026_world_range}` : "",
        r.qs_2026_asia ? `QS亚洲${r.qs_2026_asia}` : "",
        r.usnews_2025_2026_world ? `US${r.usnews_2025_2026_world}` : ""
      ].filter(Boolean);
      return `${item.province || ""}${item.city || ""} · ${[...rankingLabels, ...(item.tags || [])].join(" · ")}${item.double_first_class?.disciplines?.length ? ` · ${item.double_first_class.disciplines.slice(0, 3).join(" · ")}` : ""}`;
    },
    empty: "暂未找到匹配大学。可以换一个学校名、省份、城市或标签。"
  }
};

const renderLibrarySearch = (form) => {
  const config = librarySearchConfig[form.dataset.librarySearch];
  const input = form.querySelector('input[type="search"]');
  const target = form.querySelector("[data-library-results]");
  if (!config || !input || !target || !state.data) return;
  const clean = input.value.trim();
  if (!clean) {
    target.innerHTML = "";
    return;
  }
  const results = config.items()
    .map((item) => ({ item, score: config.score(item, clean) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name, "zh-Hans-CN"))
    .slice(0, 12);
  target.innerHTML = results.length
    ? results.map(({ item }) => `<a class="result" href="${config.href(item)}"><span>${config.type}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(config.text(item))}</small></a>`).join("")
    : `<p class="empty">${config.empty}</p>`;
};

const setupLibrarySearch = () => {
  document.querySelectorAll("[data-library-search]").forEach((form) => {
    const input = form.querySelector('input[type="search"]');
    if (!input) return;
    const params = new URLSearchParams(location.search);
    if (params.get("q")) {
      input.value = params.get("q");
      renderLibrarySearch(form);
    }
    input.addEventListener("input", () => renderLibrarySearch(form));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      renderLibrarySearch(form);
      const clean = input.value.trim();
      history.replaceState(null, "", clean ? `${location.pathname}?q=${encodeURIComponent(clean)}` : location.pathname);
    });
  });
};

const setupFavorites = () => {
  document.querySelectorAll("[data-favorite]").forEach((button) => {
    const type = button.dataset.favoriteType || "major";
    const slug = button.dataset.favorite;
    const set = favoriteSet(type);
    const inactiveLabel = type === "university" ? "收藏大学" : "收藏专业";
    const activeLabel = type === "university" ? "已收藏大学" : "已收藏专业";
    const refresh = () => {
      button.textContent = set.has(slug) ? activeLabel : inactiveLabel;
      button.classList.toggle("is-active", set.has(slug));
    };
    refresh();
    button.addEventListener("click", () => {
      if (set.has(slug)) set.delete(slug);
      else set.add(slug);
      const saved = saveFavorites();
      refresh();
      button.setAttribute("aria-pressed", set.has(slug) ? "true" : "false");
      button.title = saved
        ? (set.has(slug) ? "已加入收藏夹" : "已从收藏夹移除")
        : "浏览器阻止了本地保存，请检查隐私模式或站点存储权限";
    });
  });
};

const renderFavoriteList = (target, items, type) => {
  const set = favoriteSet(type);
  const selected = items.filter((item) => set.has(item.slug) || set.has(String(item.id)));
  if (!selected.length) {
    target.innerHTML = `<p class="empty">还没有收藏。打开${type === "university" ? "大学" : "专业"}页面，点“收藏${type === "university" ? "大学" : "专业"}”就会出现在这里。</p>`;
    return;
  }
  for (const item of selected) {
    if (set.has(String(item.id)) && !set.has(item.slug)) set.add(item.slug);
  }
  saveFavorites();
  target.innerHTML = selected.map((item) => {
    const href = type === "university" ? `/university/${item.slug}/` : `/major/${item.slug}/`;
    const text = type === "university"
      ? `${item.province || ""}${item.city || ""} · ${(item.tags || []).slice(0, 4).join(" · ")}`
      : item.ai_summary || `${item.discipline || ""} · ${item.category || ""}`;
    return `<a class="mini-result" href="${href}"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(text)}</span></a>`;
  }).join("");
};

const setupFavoritesPage = () => {
  const majorTarget = document.querySelector("#favorite-majors");
  const universityTarget = document.querySelector("#favorite-universities");
  if ((!majorTarget && !universityTarget) || !state.data) return;

  const render = async () => {
    if (majorTarget) renderFavoriteList(majorTarget, state.data.majors || [], "major");
    if (universityTarget) renderFavoriteList(universityTarget, state.data.universities || [], "university");
  };

  document.querySelectorAll("[data-clear-favorites]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.clearFavorites;
      favoriteSet(type).clear();
      saveFavorites();
      render();
      setupFavorites();
    });
  });

  render();
};

const setupEmailLogin = () => {
  const requestForm = document.querySelector("#email-login-form");
  const verifyForm = document.querySelector("#email-verify-form");
  const status = document.querySelector("#email-login-status");
  const profileTarget = document.querySelector("#auth-profile");
  const logoutButton = document.querySelector("#logout-button");
  if (!requestForm && !verifyForm && !profileTarget) return;

  const setStatus = (message, type = "empty") => {
    if (status) status.innerHTML = `<p class="${type}">${escapeHtml(message)}</p>`;
  };

  const setProfile = (profile) => {
    if (!profileTarget) return;
    if (profile?.email) {
      profileTarget.innerHTML = `
        <p class="success">已登录：${escapeHtml(profile.email)}</p>
        <p class="source-note">收藏夹当前仍会先保存在这台设备，账号同步会继续接入。</p>
      `;
      if (logoutButton) logoutButton.hidden = false;
    } else {
      profileTarget.innerHTML = `<p class="empty">还没有登录。收藏仍会先保存在当前浏览器，登录后可继续接入账号同步。</p>`;
      if (logoutButton) logoutButton.hidden = true;
    }
  };

  const saved = safeJsonParse(localStorage.getItem("majorai:profile"), null);
  if (saved?.email) {
    setProfile(saved);
    if (requestForm?.elements.email) requestForm.elements.email.value = saved.email;
    if (verifyForm?.elements.email) verifyForm.elements.email.value = saved.email;
  } else {
    setProfile(null);
  }

  const loadProfile = async () => {
    try {
      const response = await fetch("/api/auth/me", { headers: { accept: "application/json" } });
      const result = await response.json();
      if (result.authenticated && result.profile?.email) {
        localStorage.setItem("majorai:profile", JSON.stringify(result.profile));
        setProfile(result.profile);
        return;
      }
      setProfile(saved?.email ? saved : null);
    } catch {
      setProfile(saved?.email ? saved : null);
    }
  };

  requestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(requestForm.elements.email?.value || "").trim();
    if (!email) {
      setStatus("请输入邮箱。");
      return;
    }
    setStatus("正在发送验证码...");
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || result.error || "send_failed");
      if (verifyForm) verifyForm.hidden = false;
      if (verifyForm?.elements.email) verifyForm.elements.email.value = result.email || email;
      verifyForm?.elements.code?.focus();
      setStatus("验证码已发送，请查看邮箱。", "success");
    } catch (error) {
      const message = error?.message === "email_not_configured"
        ? "邮箱验证码服务正在配置中，请稍后再试。"
        : (error?.message || "验证码发送失败，请稍后再试。");
      setStatus(message);
    }
  });

  verifyForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(verifyForm.elements.email?.value || requestForm?.elements.email?.value || "").trim();
    const code = String(verifyForm.elements.code?.value || "").trim();
    if (!email || !code) {
      setStatus("请输入邮箱和验证码。");
      return;
    }
    setStatus("正在登录...");
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email, code })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || result.error || "verify_failed");
      localStorage.setItem("majorai:profile", JSON.stringify(result.profile));
      setProfile(result.profile);
      setStatus("登录成功。", "success");
    } catch (error) {
      setStatus(error?.message || "登录失败，请检查验证码。");
    }
  });

  logoutButton?.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { accept: "application/json" } });
    } catch {
      // Local cleanup still matters if the network request fails.
    }
    localStorage.removeItem("majorai:profile");
    setProfile(null);
    if (verifyForm) verifyForm.hidden = true;
    setStatus("已退出登录。", "success");
  });

  loadProfile();
};

const setupQuiz = () => {
  const form = document.querySelector("#quiz-form");
  const target = document.querySelector("#quiz-results");
  if (!form || !target || !state.data) return;
  const render = async () => {
    const tags = [...form.querySelectorAll("input:checked")].map((input) => input.value);
    if (!tags.length) {
      target.innerHTML = `<p class="empty">选择几个偏好后，会显示匹配度较高的专业。</p>`;
      return;
    }
    const scored = state.data.majors
      .map((major) => {
        const matches = (major.fit_tags || []).filter((tag) => tags.includes(tag));
        return { major, matches };
      })
      .filter((item) => item.matches.length)
      .sort((a, b) => b.matches.length - a.matches.length)
      .slice(0, 6);
    target.innerHTML = scored.length
      ? scored.map(({ major, matches }) => `<a class="mini-result" href="/major/${major.slug}/"><strong>${major.name}</strong><span>${matches.join(" · ")}</span></a>`).join("")
      : `<p class="empty">没有明显匹配项，建议减少限制或从专题页继续看。</p>`;
  };
  form.addEventListener("change", render);
  render();
};

const setupRankMatcher = () => {
  const form = document.querySelector("#rank-match-form");
  const target = document.querySelector("#rank-match-results");
  if (!form || !target || !state.data) return;

  const majorById = new Map((state.data.majors || []).map((major) => [major.id, major]));
  const universityById = new Map((state.data.universities || []).map((university) => [university.id, university]));
  const subjectRequirementIndex = buildSubjectRequirementIndex(state.data);

  const renderEmpty = () => {
    target.innerHTML = `<p class="empty">当前还没有导入该省份可核验的公开录取位次数据。可以先查看浙江；江苏、广东、河南、四川等省份会按考试院公开文件继续接入。</p>`;
  };

  const render = async () => {
    const formData = new FormData(form);
    const province = String(formData.get("province") || "").trim();
    const year = Number(formData.get("year") || 0);
    const rank = Number(formData.get("rank") || 0);
    const subjectGroup = String(formData.get("subject_group") || "").trim();

    if (!rank) {
      target.innerHTML = `<p class="empty">输入位次后，会按已导入的历史最低位次生成参考结果。</p>`;
      return;
    }

    target.innerHTML = `<p class="empty">正在读取公开位次记录...</p>`;
    const admissionScores = await ensureAdmissionScores();

    const scores = admissionScores.filter((score) => {
      if (score.province !== province) return false;
      if (year && Number(score.year) !== year) return false;
      if (subjectGroup && !String(score.subject_group || "").includes(subjectGroup)) return false;
      return Number(score.min_rank) > 0;
    });

    if (!scores.length) {
      renderEmpty();
      return;
    }

    const band = Math.max(2000, Math.round(rank * 0.08));
    const results = scores
      .map((score) => {
        const delta = Number(score.min_rank) - rank;
        const label = delta < -band ? "冲" : delta > band ? "保" : "稳";
        return {
          score,
          delta,
          label,
          major: score.major_id ? majorById.get(score.major_id) : null,
          university: universityById.get(score.university_id)
        };
      })
      .sort((left, right) => Math.abs(left.delta) - Math.abs(right.delta))
      .slice(0, 20);

    target.innerHTML = results.map(({ score, delta, label, major, university }) => {
      const direction = delta >= 0 ? `你的位次优于历史最低位次 ${Math.abs(delta)}` : `你的位次低于历史最低位次 ${Math.abs(delta)}`;
      const href = university && major ? `/university/${university.slug}/major/${major.slug}/` : "#";
      const rankClass = label === "冲" ? "rank-result-chong" : label === "保" ? "rank-result-bao" : "rank-result-wen";
      const grain = score.data_grain || "major";
      const grainLabel = grain === "major" ? "专业投档" : grain === "university_major_group" ? "院校专业组投档" : "投档参考";
      const originalName = score.major_group_name || score.major_group_code || "";
      const targetName = major
        ? originalName && originalName !== major.name ? `${major.name}（${originalName}）` : major.name
        : (originalName || "专业组/院校");
      const grainWarning = grain === "major" ? "" : " · 不是单专业位次";
      const source = score.source_url ? ` · <span>官方来源</span>` : "";
      const universityTags = renderUniversityDecisionTags(university);
      return `<a class="mini-result rank-result ${rankClass}" href="${href}">
        <strong><em>${label}</em>${university ? university.name : "未知院校"} ${targetName}</strong>
        ${universityTags}
        <span>${score.year} ${score.province} ${score.batch || ""} ${score.subject_group || ""} · ${grainLabel}${grainWarning} · 最低位次 ${score.min_rank} · ${direction}${source}</span>
      </a>`;
    }).join("");
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  form.querySelectorAll("[data-rank-sample]").forEach((button) => {
    button.addEventListener("click", () => {
      const sample = button.dataset.rankSample;
      if (sample === "shandong") {
        form.elements.province.value = "山东";
        form.elements.year.value = "2025";
        form.elements.rank.value = "800";
        form.elements.subject_group.value = "山东普通类";
      } else {
        form.elements.province.value = "浙江";
        form.elements.year.value = "2025";
        form.elements.rank.value = "1500";
        form.elements.subject_group.value = "浙江普通类";
      }
      render();
    });
  });
  render();
};

const admissionScoreComparator = (left, right) =>
  Number(right.year || 0) - Number(left.year || 0)
  || String(left.province || "").localeCompare(String(right.province || ""), "zh-Hans-CN")
  || Number(left.min_rank || 999999999) - Number(right.min_rank || 999999999);

const setupRankLines = () => {
  const form = document.querySelector("#rank-lines-form");
  const target = document.querySelector("#rank-lines-results");
  const countTarget = document.querySelector("#rank-lines-count");
  if (!form || !target || !state.data) return;

  const majorById = new Map((state.data.majors || []).map((major) => [major.id, major]));
  const universityById = new Map((state.data.universities || []).map((university) => [university.id, university]));
  const subjectRequirementIndex = buildSubjectRequirementIndex(state.data);

  const scoreName = (score) => {
    const major = score.major_id ? majorById.get(score.major_id) : null;
    return score.major_group_name || major?.name || score.major_group_code || "未匹配专业";
  };

  const renderRows = (scores) => {
    if (!scores.length) {
      target.innerHTML = `<p class="empty">没有找到符合条件的投档线。可以放宽关键词或位次上限。</p>`;
      if (countTarget) countTarget.textContent = "0 条";
      return;
    }
    const visibleScores = scores;
    const rows = visibleScores.map((score) => {
      const university = universityById.get(score.university_id);
      const major = score.major_id ? majorById.get(score.major_id) : null;
      const detailHref = university && major ? `/university/${university.slug}/major/${major.slug}/` : "";
      const source = score.source_url ? `<a href="${escapeHtml(score.source_url)}" rel="noopener noreferrer">官方来源</a>` : "来源见说明";
      const subjectRequirement = scoreSubjectRequirement(score, subjectRequirementIndex);
      return `<tr>
        <td>${escapeHtml(score.year)}</td>
        <td>${escapeHtml(score.province)}</td>
        <td>${university ? `<a href="/university/${university.slug}/">${escapeHtml(university.name)}</a>` : "未匹配院校"}</td>
        <td>${detailHref ? `<a href="${detailHref}">${escapeHtml(scoreName(score))}</a>` : escapeHtml(scoreName(score))}</td>
        <td>${escapeHtml(score.batch || "")}<br><small>${escapeHtml(dataGrainLabel(score.data_grain))}</small></td>
        <td>${escapeHtml(score.subject_group || "")}</td>
        <td>${escapeHtml(displaySubjectRequirement(subjectRequirement))}</td>
        <td>${escapeHtml(score.min_score ?? "")}</td>
        <td>${escapeHtml(score.min_rank ?? "")}</td>
        <td>${escapeHtml(score.plan_count ?? "")}</td>
        <td>${source}</td>
      </tr>`;
    }).join("");
    target.innerHTML = `<div class="table-wrap rank-line-table"><table>
      <thead><tr><th>年份</th><th>省份</th><th>学校</th><th>招生名称</th><th>批次</th><th>科类</th><th>选科要求</th><th>最低分</th><th>最低位次</th><th>计划数</th><th>来源</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
    if (countTarget) countTarget.textContent = `${scores.length} 条`;
  };

  const render = async () => {
    const formData = new FormData(form);
    const province = String(formData.get("province") || "").trim();
    const year = Number(formData.get("year") || 0);
    const keyword = normalize(formData.get("keyword") || "");
    const maxRank = Number(formData.get("max_rank") || 0);
    target.innerHTML = `<p class="empty">正在读取投档线...</p>`;
    const admissionScores = await ensureAdmissionScores();
    const filtered = admissionScores
      .filter((score) => {
        if (province && score.province !== province) return false;
        if (year && Number(score.year) !== year) return false;
        if (maxRank && Number(score.min_rank || 0) > maxRank) return false;
        if (keyword) {
          const university = universityById.get(score.university_id);
          const haystack = normalize(`${university?.name || ""} ${scoreName(score)} ${score.batch || ""} ${score.subject_group || ""} ${scoreSubjectRequirement(score, subjectRequirementIndex)}`);
          if (!haystack.includes(keyword)) return false;
        }
        return Number(score.min_rank || 0) > 0 || Number(score.min_score || 0) > 0;
      })
      .sort((left, right) => Number(left.min_rank || 999999999) - Number(right.min_rank || 999999999));
    renderRows(filtered);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  const params = new URLSearchParams(location.search);
  if (params.has("province")) form.elements.province.value = params.get("province");
  if (params.has("year")) form.elements.year.value = params.get("year");
  if (params.has("keyword")) form.elements.keyword.value = params.get("keyword");
  render();
};

const setupUniversityScoreFilters = () => {
  const subjectRequirementIndex = buildSubjectRequirementIndex(state.data);
  document.querySelectorAll("[data-university-score-filter]").forEach((root) => {
    const form = root.querySelector(".score-filter-form");
    const target = root.querySelector("[data-score-filter-results]");
    const summary = root.querySelector("[data-score-filter-summary]");
    const universityId = Number(root.dataset.universityId || 0);
    const total = Number(root.dataset.total || 0);
    if (!form || !target || !universityId) return;

    const majorById = new Map((state.data?.majors || []).map((major) => [major.id, major]));
    const renderRows = (scores) => {
      if (!scores.length) {
        target.innerHTML = `<p class="empty">当前筛选下没有投档线记录，可以切换省份、年份或清空关键词。</p>`;
        if (summary) summary.textContent = `当前显示 0 条；全库 ${total} 条。`;
        return;
      }
      const visibleScores = scores;
      const rows = visibleScores.map((score) => {
        const major = score.major_id ? majorById.get(score.major_id) : null;
        const name = score.major_group_name || major?.name || score.major_group_code || "未匹配招生名称";
        const href = major ? `/university/${location.pathname.split("/").filter(Boolean).at(-1) || ""}/major/${major.slug}/` : "";
        const source = score.source_url ? `<a href="${escapeHtml(score.source_url)}" rel="noopener noreferrer">官方来源</a>` : "来源见说明";
        const subjectRequirement = scoreSubjectRequirement(score, subjectRequirementIndex);
        return `<tr>
          <td>${escapeHtml(score.year)}</td>
          <td>${escapeHtml(score.province)}</td>
          <td>${href ? `<a href="${href}">${escapeHtml(name)}</a>` : escapeHtml(name)}</td>
          <td>${escapeHtml(dataGrainLabel(score.data_grain))}</td>
          <td>${escapeHtml(score.batch || "")}</td>
          <td>${escapeHtml(score.subject_group || "")}</td>
          <td>${escapeHtml(displaySubjectRequirement(subjectRequirement))}</td>
          <td>${escapeHtml(score.min_score ?? "")}</td>
          <td>${escapeHtml(score.min_rank ?? "")}</td>
          <td>${escapeHtml(score.plan_count ?? "")}</td>
          <td>${source}</td>
        </tr>`;
      }).join("");
      target.innerHTML = `<div class="table-wrap rank-line-table"><table>
        <thead><tr><th>年份</th><th>省份</th><th>招生名称</th><th>粒度</th><th>批次</th><th>科类</th><th>选科要求</th><th>最低分</th><th>最低位次</th><th>计划数</th><th>来源</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
      if (summary) summary.textContent = `当前显示 ${scores.length} 条；全库 ${total} 条。`;
    };

    const render = async () => {
      const formData = new FormData(form);
      const province = String(formData.get("province") || "").trim();
      const year = String(formData.get("year") || "").trim();
      const grain = String(formData.get("grain") || "").trim();
      const keyword = normalize(formData.get("keyword") || "");
      const admissionScores = await ensureAdmissionScores();
      const scores = admissionScores
        .filter((score) => Number(score.university_id) === universityId)
        .filter((score) => !province || score.province === province)
        .filter((score) => !year || String(score.year) === year)
        .filter((score) => !grain || (score.data_grain || "") === grain)
        .filter((score) => {
          if (!keyword) return true;
          const major = score.major_id ? majorById.get(score.major_id) : null;
          return normalize(`${score.major_group_name || ""} ${major?.name || ""} ${score.batch || ""} ${score.subject_group || ""} ${scoreSubjectRequirement(score, subjectRequirementIndex)} ${score.major_group_code || ""}`).includes(keyword);
        })
        .sort(admissionScoreComparator);
      renderRows(scores);
    };

    form.addEventListener("input", render);
    form.addEventListener("change", render);
  });
};

const parseChoices = (value) => String(value || "")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line, index) => {
    const parts = line.split(/\s+/);
    const university = parts[0] || "";
    const city = parts.length >= 3 ? parts[parts.length - 1] : "";
    const major = parts.length >= 3 ? parts.slice(1, -1).join("") : parts.slice(1).join("");
    const notes = line.replace(university, "").replace(major, "").replace(city, "").trim();
    return { originalPosition: index + 1, raw: line, university, major, city, notes };
  });

const findMajorForChoice = (choice, majorByName, majorsForMatching = []) => {
  const direct = majorByName.get(choice.major);
  if (direct) return direct;
  const text = `${choice.major} ${choice.raw}`;
  return majorsForMatching.find((major) => text.includes(major.name) || (choice.major.length >= 2 && major.name.includes(choice.major))) || null;
};

const choiceKnownSubjectRequirement = (choice, context, helpers) => {
  const universityInfo = helpers.universityByName.get(choice.university);
  const majorInfo = findMajorForChoice(choice, helpers.majorByName, helpers.majorsForMatching);
  const matched = findSubjectRequirement(helpers.subjectRequirementIndex, {
    universityId: universityInfo?.id,
    majorId: majorInfo?.id,
    province: context.province
  });
  return matched?.text || "";
};

const classifyBand = (index, total) => {
  const ratio = (index + 1) / Math.max(total, 1);
  if (ratio <= 0.18) return "冲";
  if (ratio <= 0.75) return "稳";
  return "保";
};

const buildPlannerContext = ({ formData, choices, siteData }) => ({
  strategy: "rules",
  province: String(formData.get("province") || "").trim(),
  rank: Number(formData.get("rank") || 0),
  likes: splitWords(formData.get("likes")),
  dislikes: splitWords(formData.get("dislikes")),
  cities: splitWords(formData.get("cities")),
  selectedSubjects: parseSubjects(formData.getAll("subjects")),
  choices,
  siteData
});

const splitDislikeRules = (items = []) => {
  const school = [];
  const general = [];
  for (const item of items) {
    const match = String(item).match(/^(学校|院校)[:：](.+)$/);
    if (match) school.push(match[2].trim());
    else general.push(item);
  }
  return { school, general };
};

const classifyDislikeHits = (choice, universityInfo, dislikes) => {
  const rules = splitDislikeRules(dislikes);
  const schoolText = `${choice.university} ${(universityInfo?.tags || []).join(" ")} ${universityInfo?.ownership || ""} ${universityInfo?.type || ""}`;
  const majorText = `${choice.major} ${choice.notes || ""}`;
  const remarkText = `${choice.raw.replace(choice.university, "").replace(choice.city, "")}`;
  const schoolHits = rules.school.filter((word) => schoolText.includes(word)).map((word) => `学校:${word}`);
  const generalHits = rules.general.filter((word) => majorText.includes(word) || remarkText.includes(word));
  return [...schoolHits, ...generalHits];
};

const scorePlannerChoices = (context, helpers) => {
  const { choices, likes, dislikes, cities, selectedSubjects, rank } = context;
  const { universityByName, universityDecisionTags } = helpers;
  const universityCounts = new Map();
  const majorCounts = new Map();
  const cityCounts = new Map();

  for (const choice of choices) {
    universityCounts.set(choice.university, (universityCounts.get(choice.university) || 0) + 1);
    majorCounts.set(choice.major, (majorCounts.get(choice.major) || 0) + 1);
    if (choice.city) cityCounts.set(choice.city, (cityCounts.get(choice.city) || 0) + 1);
  }

  const scored = choices.map((choice, index) => {
    const universityInfo = universityByName.get(choice.university);
    const schoolTags = universityDecisionTags(universityInfo);
    const preferenceText = `${choice.major} ${choice.city} ${choice.notes || ""}`;
    const likeHits = likes.filter((word) => preferenceText.includes(word));
    const dislikeHits = classifyDislikeHits(choice, universityInfo, dislikes);
    const cityHits = cities.filter((word) => `${choice.city} ${choice.raw}`.includes(word));
    const knownSubjectRequirement = choiceKnownSubjectRequirement(choice, context, helpers);
    const subjectFit = checkSubjectFit(choice, selectedSubjects, knownSubjectRequirement);
    const aiHit = /人工智能|AI|智能|计算机|软件|数据|电子|机器人|网络空间/.test(preferenceText);
    const duplicatePenalty = Math.max(0, (universityCounts.get(choice.university) || 1) - 2) * 4 + Math.max(0, (majorCounts.get(choice.major) || 1) - 2) * 3;
    const subjectPenalty = subjectFit.status === "blocked" ? 120 : subjectFit.status === "warn" ? 35 : subjectFit.status === "unknown" ? 4 : 0;
    const schoolTagBonus = (schoolTags.includes("有推免资格") ? 4 : 0)
      + (schoolTags.includes("双一流") ? 3 : 0)
      + (schoolTags.includes("985") ? 3 : schoolTags.includes("211") ? 2 : 0);
    const preferenceScore = 55 + likeHits.length * 12 + cityHits.length * 10 + (aiHit ? 8 : 0) + schoolTagBonus - dislikeHits.length * 25 - duplicatePenalty - subjectPenalty;
    const satisfaction = Math.max(0, Math.min(100, preferenceScore));
    const rankSignal = rank ? Math.max(0, 12 - Math.floor(index / 8)) : 6;
    return {
      ...choice,
      universityInfo,
      schoolTags,
      likeHits,
      dislikeHits,
      cityHits,
      subjectFit,
      knownSubjectRequirement,
      satisfaction,
      totalScore: satisfaction + rankSignal,
      risk: subjectFit.status === "blocked" ? subjectFit.note : dislikeHits.length ? `命中排除项：${dislikeHits.join("、")}` : duplicatePenalty ? "学校或专业重复偏多" : subjectFit.status === "warn" ? subjectFit.note : "",
      reason: [
        subjectFit.status === "blocked" ? "选科不符合，建议删除或核实" : "",
        subjectFit.status === "warn" ? "选科可能受限" : "",
        likeHits.length ? `匹配兴趣：${likeHits.join("、")}` : "",
        cityHits.length ? `匹配城市：${cityHits.join("、")}` : "",
        aiHit ? "AI/计算机/智能方向加权" : "",
        schoolTags.length ? `院校标签：${schoolTags.join("、")}` : "",
        dislikeHits.length ? `建议谨慎：${dislikeHits.join("、")}` : "",
        duplicatePenalty ? "重复度扣分" : ""
      ].filter(Boolean).join("；") || "保留为备选，等待历史位次数据进一步校准"
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  return { scored, universityCounts, majorCounts, cityCounts };
};

const setupPlanner = () => {
  const form = document.querySelector("#planner-form");
  const target = document.querySelector("#planner-results");
  const sampleButton = document.querySelector("#planner-sample");
  const printButton = document.querySelector("#planner-print");
  if (!form || !target) return;
  const universityByName = new Map((state.data?.universities || []).map((university) => [university.name, university]));
  const majorByName = new Map((state.data?.majors || []).map((major) => [major.name, major]));
  const majorsForMatching = (state.data?.majors || []).slice().sort((left, right) => right.name.length - left.name.length);
  const subjectRequirementIndex = buildSubjectRequirementIndex(state.data);

  const sampleChoices = [
    "浙江工业大学 软件工程 杭州",
    "杭州电子科技大学 人工智能 杭州",
    "宁波大学 计算机科学与技术 宁波",
    "浙江理工大学 数据科学与大数据技术 杭州",
    "浙江工商大学 信息管理与信息系统 杭州",
    "中国计量大学 电子信息工程 杭州",
    "浙江师范大学 计算机科学与技术 金华",
    "温州大学 网络工程 温州",
    "浙江农林大学 物联网工程 杭州",
    "湖州师范学院 软件工程 湖州",
    "绍兴文理学院 数据科学与大数据技术 绍兴",
    "嘉兴大学 电子信息工程 嘉兴"
  ].join("\n");

  const renderWelcome = () => {
    target.innerHTML = `<p class="empty">粘贴志愿清单后，会生成排序建议、结构健康评分、风险提示和每个志愿的排序理由。</p>`;
  };

  const render = () => {
    const formData = new FormData(form);
    const choices = parseChoices(formData.get("choices"));

    if (!choices.length) {
      renderWelcome();
      return;
    }

    const context = buildPlannerContext({ formData, choices, siteData: state.data });
    const { scored, universityCounts, majorCounts, cityCounts } = scorePlannerChoices(context, {
      universityByName,
      universityDecisionTags,
      majorByName,
      majorsForMatching,
      subjectRequirementIndex
    });

    const total = scored.length;
    const ranked = scored.map((item, index) => ({ ...item, band: classifyBand(index, total) }));
    const bandCounts = ranked.reduce((acc, item) => {
      acc[item.band] = (acc[item.band] || 0) + 1;
      return acc;
    }, {});
    const bandPct = (band) => Math.round(((bandCounts[band] || 0) / total) * 100);

    const risks = [];
    if (bandPct("冲") > 25) risks.push("冲刺志愿偏多，建议增加稳和保。");
    if (bandPct("保") < 18) risks.push("保底不足，建议增加更稳的院校专业组合。");
    if ([...universityCounts.values()].some((count) => count >= Math.max(4, Math.ceil(total * 0.2)))) risks.push("重复学校偏多，可能降低选择弹性。");
    if ([...majorCounts.values()].some((count) => count >= Math.max(5, Math.ceil(total * 0.25)))) risks.push("重复专业偏多，建议加入相近但不同的替代方向。");
    if (context.cities.length && bandPct("保") < 25 && [...cityCounts.keys()].every((city) => context.cities.includes(city))) risks.push("城市过于集中，保底层可以放宽城市。");
    if (ranked.some((item) => item.dislikeHits.length)) risks.push("清单中存在你明确不喜欢或排除的方向。");
    const blockedBySubject = ranked.filter((item) => item.subjectFit.status === "blocked");
    const warnedBySubject = ranked.filter((item) => item.subjectFit.status === "warn");
    if (blockedBySubject.length) risks.push(`${blockedBySubject.length} 个志愿不符合已写明的选科要求，建议删除或替换。`);
    if (warnedBySubject.length) risks.push(`${warnedBySubject.length} 个志愿存在选科限制风险，需要核对当年招生计划。`);

    const avgSatisfaction = Math.round(ranked.reduce((sum, item) => sum + item.satisfaction, 0) / total);
    const subjectOkCount = ranked.filter((item) => ["ok", "soft-ok"].includes(item.subjectFit.status)).length;
    const structureScore = Math.max(0, Math.min(100, 100 - risks.length * 8 - blockedBySubject.length * 12 - warnedBySubject.length * 4 - Math.abs(bandPct("稳") - 55) * 0.5 - Math.max(0, 20 - bandPct("保"))));

    target.innerHTML = `
      <div class="score-board">
        <div><strong>${Math.round(structureScore)}</strong><span>结构健康</span></div>
        <div><strong>${avgSatisfaction}</strong><span>专业满意度</span></div>
        <div><strong>${subjectOkCount}/${total}</strong><span>选科可报</span></div>
        <div><strong>${bandPct("冲")}%</strong><span>冲</span></div>
        <div><strong>${bandPct("稳")}%</strong><span>稳</span></div>
        <div><strong>${bandPct("保")}%</strong><span>保</span></div>
      </div>
      ${risks.length ? `<div class="risk-box"><strong>发现 ${risks.length} 个风险</strong><ul>${risks.map((risk) => `<li>${risk}</li>`).join("")}</ul></div>` : `<p class="success">结构初步健康。接入正式位次数据后可继续校准冲稳保边界。</p>`}
      <div class="table-wrap"><table>
        <thead><tr><th>建议顺序</th><th>志愿</th><th>选科检查</th><th>分层</th><th>满意度</th><th>排序理由</th></tr></thead>
        <tbody>${ranked.map((item, index) => `<tr>
          <td>${index + 1}</td>
          <td><strong>${item.university}</strong> ${item.major}${item.city ? ` · ${item.city}` : ""}<br>${renderUniversityDecisionTags(item.universityInfo)}<small>原第 ${item.originalPosition} 位</small></td>
          <td><span class="status-pill">${item.subjectFit.status === "blocked" ? "不可报" : item.subjectFit.status === "warn" ? "需核对" : item.subjectFit.status === "unknown" ? "未确认" : "通过"}</span><br><small>${item.subjectFit.label}${item.subjectFit.source ? ` · ${item.subjectFit.source}` : ""}</small></td>
          <td>${item.band}</td>
          <td>${item.satisfaction}</td>
          <td>${item.reason}${item.risk ? `<br><span class="danger">${item.risk}</span>` : ""}</td>
        </tr>`).join("")}</tbody>
      </table></div>
      <p class="hint">排序会综合选考科目、偏好、城市、重复度、排除项和风险规则。选科检查是前置筛查；最终必须以当年省考试院招生计划和学校招生章程为准。</p>
    `;
  };

  sampleButton?.addEventListener("click", () => {
    form.elements.province.value = "浙江";
    form.elements.rank.value = "18000";
    form.querySelectorAll('input[name="subjects"]').forEach((input) => {
      input.checked = ["物理", "化学", "技术"].includes(input.value);
    });
    form.elements.likes.value = "计算机、AI、电子、杭州";
    form.elements.dislikes.value = "医学、师范、民办、中外合作";
    form.elements.cities.value = "杭州、上海、深圳";
    form.elements.choices.value = sampleChoices;
    render();
  });

  printButton?.addEventListener("click", () => {
    if (!target.textContent.trim() || target.textContent.includes("粘贴志愿清单")) {
      render();
    }
    document.body.classList.add("print-report");
    window.print();
    setTimeout(() => document.body.classList.remove("print-report"), 500);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  renderWelcome();
};

const setupFeedbackForm = () => {
  const form = document.querySelector("#feedback-form");
  const target = document.querySelector("#feedback-status");
  if (!form || !target) return;

  const saved = JSON.parse(localStorage.getItem("majorai:feedback-drafts") || localStorage.getItem("openmajor:feedback-drafts") || "[]");
  const setStatus = (message, type = "empty") => {
    target.innerHTML = `<p class="${type}">${message}</p>`;
  };

  const pageUrlInput = form.querySelector('[name="page_url"]');
  if (pageUrlInput && !pageUrlInput.value) pageUrlInput.value = document.referrer || location.href;
  if (saved.length) setStatus(`本地暂存 ${saved.length} 条反馈；上线配置 D1 后可重新提交。`);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.page_url = payload.page_url || location.href;
    if (!String(payload.message || "").trim()) {
      setStatus("请先填写反馈内容。");
      return;
    }
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "submit_failed");
      form.reset();
      if (pageUrlInput) pageUrlInput.value = document.referrer || location.href;
      setStatus(result.stored === false ? "已收到反馈请求；当前环境未配置数据库，已返回可诊断状态。" : "反馈已提交，我们会按公开来源优先级处理。", "success");
    } catch {
      const drafts = JSON.parse(localStorage.getItem("majorai:feedback-drafts") || localStorage.getItem("openmajor:feedback-drafts") || "[]");
      drafts.push({ ...payload, saved_at: new Date().toISOString() });
      localStorage.setItem("majorai:feedback-drafts", JSON.stringify(drafts.slice(-20)));
      setStatus("网络或接口暂不可用，已先暂存在本机浏览器。上线后可重新提交。");
    }
  });
};

const setupCooperationFilter = () => {
  const form = document.querySelector("[data-cooperation-filter]");
  if (!form) return;
  const input = form.querySelector('input[name="q"]');
  const rows = [...document.querySelectorAll("[data-cooperation-row]")];
  const count = document.querySelector("[data-cooperation-count]");
  const apply = () => {
    const keyword = normalize(input?.value || "");
    let visible = 0;
    for (const row of rows) {
      const matched = !keyword || normalize(row.dataset.search || row.textContent || "").includes(keyword);
      row.hidden = !matched;
      if (matched) visible += 1;
    }
    if (count) count.textContent = `当前显示 ${visible} 条；全库共 ${rows.length} 条`;
  };
  const params = new URLSearchParams(location.search);
  if (input && params.has("q")) input.value = params.get("q");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    apply();
  });
  input?.addEventListener("input", apply);
  apply();
};

const setupCivilServiceFilter = () => {
  const form = document.querySelector("[data-civil-service-filter]");
  if (!form) return;
  const scopeInput = form.querySelector('select[name="scope"]');
  const keywordInput = form.querySelector('input[name="q"]');
  const rows = [...document.querySelectorAll("[data-civil-row]")];
  const sections = [...document.querySelectorAll("[data-civil-section]")];
  const count = document.querySelector("[data-civil-service-count]");
  const apply = () => {
    const scope = scopeInput?.value || "";
    const keyword = normalize(keywordInput?.value || "");
    let visible = 0;
    for (const section of sections) {
      section.hidden = Boolean(scope && section.dataset.civilSection !== scope);
    }
    for (const row of rows) {
      const scopeMatched = !scope || row.dataset.scope === scope;
      const keywordMatched = !keyword || normalize(row.dataset.search || row.textContent || "").includes(keyword);
      const matched = scopeMatched && keywordMatched;
      row.hidden = !matched;
      if (matched) visible += 1;
    }
    if (count) count.textContent = `当前显示 ${visible} 条；全库共 ${rows.length} 条`;
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    apply();
  });
  form.addEventListener("input", apply);
  form.addEventListener("change", apply);
  apply();
};

const boot = async () => {
  try {
    const response = await fetch("/data/site-data.json");
    state.data = await response.json();
  } catch {
    state.data = null;
  }
  setupSearch();
  setupLibrarySearch();
  setupFavorites();
  setupFavoritesPage();
  setupEmailLogin();
  setupQuiz();
  setupRankMatcher();
  setupRankLines();
  setupUniversityScoreFilters();
  setupCooperationFilter();
  setupCivilServiceFilter();
  setupPlanner();
  setupFeedbackForm();
};

boot();
