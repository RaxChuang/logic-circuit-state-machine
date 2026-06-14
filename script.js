const stateNames = ["A", "B", "C", "D", "E", "F", "G", "H"];
let currentModel = "mealy";

const modelButtons = document.querySelectorAll("[data-model]");
const ffTypeEl = document.querySelector("#ffType");
const stateCountEl = document.querySelector("#stateCount");
const tableArea = document.querySelector("#tableArea");
const results = document.querySelector("#results");
const clearBtn = document.querySelector("#clearBtn");
const runBtn = document.querySelector("#runBtn");
const assignmentPanel = document.querySelector("#assignmentPanel");
const tableStatus = document.querySelector("#tableStatus");
const specificationText = document.querySelector("#specificationText");
const generateSpecBtn = document.querySelector("#generateSpecBtn");
const specStatus = document.querySelector("#specStatus");
const specMessage = document.querySelector("#specMessage");

modelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.model === currentModel) {
      return;
    }
    const nextStateValues = captureNextStateValues();
    setCurrentModel(button.dataset.model);
    renderTable(nextStateValues);
    clearResults();
  });
});

ffTypeEl.addEventListener("change", () => {
  clearResults();
});

stateCountEl.addEventListener("change", () => {
  renderTable(captureNextStateValues());
  clearResults();
});

generateSpecBtn.addEventListener("click", () => {
  generateTableFromDescription();
});

assignmentPanel.addEventListener("input", (event) => {
  if (!event.target.matches("[data-state-name]")) {
    return;
  }

  const index = Number(event.target.dataset.stateName);
  const sanitized = sanitizeStateName(event.target.value, index);
  event.target.value = sanitized;
  stateNames[index] = sanitized;
  syncStateName(index);
  clearResults();
});

tableArea.addEventListener("change", (event) => {
  if (!event.target.matches("select[data-next], select[data-output]")) {
    return;
  }

  if (currentModel === "moore" && event.target.matches("select[data-output]")) {
    syncMooreOutput(event.target);
  }

  clearResults();
});

clearBtn.addEventListener("click", () => {
  document.querySelectorAll("select[data-next]").forEach((select) => {
    select.value = "0";
  });
  document.querySelectorAll("select[data-output]").forEach((select) => {
    select.value = "0";
  });
  clearResults();
});

runBtn.addEventListener("click", () => {
  const analysis = analyzeTable();
  renderResults(analysis);
});

function getConfig() {
  const stateCount = Number(stateCountEl.value);
  const inputBits = 1;
  const stateBits = Math.ceil(Math.log2(stateCount));

  return {
    model: currentModel,
    ffType: ffTypeEl.value,
    stateCount,
    inputBits,
    stateBits,
    qVars: variableNames("Q", stateBits),
    xVars: variableNames("X", inputBits),
    states: stateNames.slice(0, stateCount),
    inputs: combinations(inputBits),
  };
}

function variableNames(prefix, count) {
  if (count === 1) {
    return [`${prefix}0`];
  }
  return Array.from({ length: count }, (_, index) => `${prefix}${count - index - 1}`);
}

function combinations(bitCount) {
  const total = 2 ** bitCount;
  return Array.from({ length: total }, (_, value) => toBits(value, bitCount).join(""));
}

function toBits(value, length) {
  return value.toString(2).padStart(length, "0").split("").map(Number);
}

function bitString(value, length) {
  return toBits(value, length).join("");
}

function renderTable(nextStateValues = new Map()) {
  const config = getConfig();
  renderAssignment(config);
  tableStatus.textContent = `${config.states.length} states, x=0 / x=1`;

  const table = document.createElement("table");
  table.className = "state-table";
  const thead = document.createElement("thead");
  const groupRow = document.createElement("tr");
  const presentHead = document.createElement("th");
  presentHead.rowSpan = 2;
  presentHead.textContent = "Present";
  groupRow.appendChild(presentHead);

  const assignHead = document.createElement("th");
  assignHead.rowSpan = 2;
  assignHead.textContent = "Assign";
  groupRow.appendChild(assignHead);

  const nextHead = document.createElement("th");
  nextHead.colSpan = config.inputs.length;
  nextHead.textContent = "Next State";
  groupRow.appendChild(nextHead);

  const outputHead = document.createElement("th");
  outputHead.colSpan = config.model === "mealy" ? config.inputs.length : 1;
  outputHead.rowSpan = config.model === "mealy" ? 1 : 2;
  outputHead.textContent = config.model === "mealy" ? "Output" : "Output Z";
  groupRow.appendChild(outputHead);

  const inputRow = document.createElement("tr");
  config.inputs.forEach((input) => {
    const th = document.createElement("th");
    th.textContent = `x=${input}`;
    inputRow.appendChild(th);
  });

  if (config.model === "mealy") {
    config.inputs.forEach((input) => {
      const th = document.createElement("th");
      th.textContent = `x=${input}`;
      inputRow.appendChild(th);
    });
  }

  thead.appendChild(groupRow);
  thead.appendChild(inputRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  config.states.forEach((stateName, stateIndex) => {
    const tr = document.createElement("tr");
    const stateCell = document.createElement("td");
    stateCell.className = "state-cell";
    stateCell.dataset.presentStateIndex = String(stateIndex);
    stateCell.appendChild(createDisplayBox(stateName));
    tr.appendChild(stateCell);

    const assignCell = document.createElement("td");
    assignCell.className = "assign-cell";
    assignCell.appendChild(createDisplayBox(bitString(stateIndex, config.stateBits)));
    tr.appendChild(assignCell);

    config.inputs.forEach((_, inputIndex) => {
      const nextCell = document.createElement("td");
      nextCell.appendChild(createNextStateSelect(
        config,
        stateIndex,
        inputIndex,
        nextStateValues.get(`${stateIndex}-${inputIndex}`),
      ));
      tr.appendChild(nextCell);
    });

    if (config.model === "mealy") {
      config.inputs.forEach((_, inputIndex) => {
        const outputCell = document.createElement("td");
        outputCell.appendChild(createOutputSelect(`out-${stateIndex}-${inputIndex}`, {
          stateIndex,
          inputIndex,
        }));
        tr.appendChild(outputCell);
      });
    } else {
      const outputCell = document.createElement("td");
      outputCell.appendChild(createOutputSelect(`out-${stateIndex}`, {
        stateIndex,
      }));
      tr.appendChild(outputCell);
    }

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.appendChild(table);

  tableArea.replaceChildren(wrap);
}

function renderAssignment(config) {
  const list = config.states.map((stateName, index) => {
    return `
      <label class="assignment-code">
        <input class="state-name-input" data-state-name="${index}" value="${escapeHtml(stateName)}" maxlength="4" aria-label="State ${index + 1} name">
        <strong>${bitString(index, config.stateBits)}</strong>
      </label>
    `;
  }).join("");

  assignmentPanel.innerHTML = `
    <div class="assignment-title">State Assignment</div>
    <div class="assignment-list">${list}</div>
  `;
}

function appendCell(row, text, className) {
  const cell = document.createElement("td");
  cell.textContent = text;
  cell.className = className;
  row.appendChild(cell);
}

function stateLabel(index, config = getConfig()) {
  return config.states[index];
}

function sanitizeStateName(value, index) {
  const cleaned = value.toUpperCase().replace(/[^A-Z]/g, "");
  return cleaned || stateNames[index] || `S${index}`;
}

function syncStateName(index) {
  const config = getConfig();
  document.querySelectorAll(`[data-present-state-index="${index}"]`).forEach((cell) => {
    const display = cell.querySelector(".display-box");
    if (display) {
      display.textContent = stateLabel(index, config);
    }
  });
  document.querySelectorAll(`select[data-next] option[value="${index}"]`).forEach((option) => {
    option.textContent = config.states[index];
  });
}

function syncMooreOutput(source) {
  if (!source.dataset.inputIndex) {
    return;
  }

  const selector = `select[data-output][data-state-index="${source.dataset.stateIndex}"]`;
  document.querySelectorAll(selector).forEach((select) => {
    select.value = source.value;
  });
}

function createNextStateSelect(config, stateIndex, inputIndex, selectedValue) {
  const select = document.createElement("select");
  select.className = "inline-select";
  select.dataset.next = "true";
  select.dataset.stateIndex = String(stateIndex);
  select.dataset.inputIndex = String(inputIndex);

  config.states.forEach((stateName, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = stateName;
    select.appendChild(option);
  });

  if (selectedValue !== undefined && Number(selectedValue) < config.stateCount) {
    select.value = String(selectedValue);
  }

  return select;
}

function captureNextStateValues() {
  const values = new Map();
  document.querySelectorAll("select[data-next]").forEach((select) => {
    values.set(`${select.dataset.stateIndex}-${select.dataset.inputIndex}`, select.value);
  });
  return values;
}

function setCurrentModel(model) {
  currentModel = model;
  modelButtons.forEach((item) => {
    const isActive = item.dataset.model === model;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-pressed", String(isActive));
  });
}

function createDisplayBox(text) {
  const span = document.createElement("span");
  span.className = "display-box";
  span.textContent = text;
  return span;
}

function createOutputSelect(id, data) {
  const select = document.createElement("select");
  select.className = "inline-select";
  select.id = id;
  select.dataset.output = "true";
  Object.entries(data).forEach(([key, value]) => {
    select.dataset[key] = String(value);
  });

  ["0", "1", "X"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    if (currentModel === "moore") {
      syncMooreOutput(select);
    }
  });

  return select;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateTableFromDescription() {
  const description = specificationText.value.trim();
  specMessage.className = "specification-message";

  if (!description) {
    specMessage.textContent = "請先輸入題目敘述。";
    specMessage.classList.add("is-error");
    return;
  }

  try {
    const specification = parseSequenceSpecification(description);
    const machine = buildSequenceMachine(specification);

    setCurrentModel(specification.model);
    stateCountEl.value = String(machine.states.length);
    machine.states.forEach((_, index) => {
      stateNames[index] = String.fromCharCode(65 + index);
    });
    renderTable();
    applyGeneratedMachine(machine, specification);
    clearResults();

    const patternText = specification.patterns.join(", ");
    specStatus.textContent = "Generated";
    specMessage.textContent = `${specification.model === "mealy" ? "Mealy" : "Moore"} · patterns ${patternText} · ${machine.states.length} states · ${specification.overlap ? "overlap" : "non-overlap"}`;
    specMessage.classList.add("is-success");
  } catch (error) {
    specStatus.textContent = "Manual";
    specMessage.textContent = error.message;
    specMessage.classList.add("is-error");
  }
}

function parseSequenceSpecification(description) {
  const normalized = description
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[０１]/g, (digit) => digit === "０" ? "0" : "1");
  const model = /\bmoore\b|摩爾/.test(normalized) ? "moore" : "mealy";
  const overlap = !/\bnon[-\s]?overlap|overlapping\s+is\s+not\s+allowed|without\s+overlap|不允許重疊|不可重疊|禁止重疊/.test(normalized);
  const requestedStateMatch = normalized.match(/(?:\(|\b)([2-8])\s*(?:states?|個?\s*狀態)/);
  const requestedStateCount = requestedStateMatch ? Number(requestedStateMatch[1]) : null;
  const patterns = extractBinaryPatterns(normalized);

  if (patterns.length === 0) {
    throw new Error("目前可辨識指定二進位序列，或「連續 N 個 0／1」類型的敘述。");
  }

  return {
    model,
    overlap,
    patterns,
    requestedStateCount,
  };
}

function extractBinaryPatterns(text) {
  const patterns = [];
  const addPattern = (pattern) => {
    if (/^[01]{2,}$/.test(pattern) && !patterns.includes(pattern)) {
      patterns.push(pattern);
    }
  };

  const consecutiveEnglish = /(?:exactly\s+)?(one|two|three|four|five|six|seven|eight|\d+)\s+consecutive\s+([01])(?:'s|s)?/g;
  for (const match of text.matchAll(consecutiveEnglish)) {
    const count = parseNumberWord(match[1]);
    if (count >= 2 && count <= 8) {
      addPattern(match[2].repeat(count));
    }
  }

  const consecutiveChinese = /連續\s*([一二三四五六七八\d]+)\s*個?\s*([01])/g;
  for (const match of text.matchAll(consecutiveChinese)) {
    const count = parseNumberWord(match[1]);
    if (count >= 2 && count <= 8) {
      addPattern(match[2].repeat(count));
    }
  }

  const reverseChinese = /([01])\s*連續\s*([一二三四五六七八\d]+)\s*個?/g;
  for (const match of text.matchAll(reverseChinese)) {
    const count = parseNumberWord(match[2]);
    if (count >= 2 && count <= 8) {
      addPattern(match[1].repeat(count));
    }
  }

  for (const match of text.matchAll(/(?:sequence|pattern|序列|樣式|偵測|detect)\s*(?:is|為|：|:)?\s*["']?([01]{2,8})["']?/g)) {
    addPattern(match[1]);
  }

  if (patterns.length === 1) {
    const count = patterns[0].length;
    if (/0(?:'s|s)?\s+(?:or|and|或|與)\s+(?:exactly\s+)?(?:the\s+same\s+number\s+of\s+)?1(?:'s|s)?/.test(text)) {
      addPattern("1".repeat(count));
    } else if (/1(?:'s|s)?\s+(?:or|and|或|與)\s+(?:exactly\s+)?(?:the\s+same\s+number\s+of\s+)?0(?:'s|s)?/.test(text)) {
      addPattern("0".repeat(count));
    }
  }

  return patterns;
}

function parseNumberWord(value) {
  const numberWords = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
  };
  return numberWords[value] ?? Number(value);
}

function buildSequenceMachine(specification) {
  const baseStates = new Set([""]);
  specification.patterns.forEach((pattern) => {
    for (let length = 1; length <= pattern.length; length += 1) {
      baseStates.add(pattern.slice(0, length));
    }
  });

  const requestedCount = specification.requestedStateCount ?? baseStates.size;
  const targetCount = Math.max(requestedCount, baseStates.size);
  if (targetCount > 8) {
    throw new Error("目前最多支援 8 個狀態；請縮短序列或指定 8 states 以下。");
  }

  const states = [...baseStates];
  const maxPatternLength = Math.max(...specification.patterns.map((pattern) => pattern.length));
  for (let length = 1; states.length < targetCount && length <= maxPatternLength + 2; length += 1) {
    combinations(length).forEach((bits) => {
      if (states.length < targetCount && !states.includes(bits)) {
        states.push(bits);
      }
    });
  }

  const transitions = states.map((history) => {
    return ["0", "1"].map((input) => {
      const combined = `${history}${input}`;
      const detected = specification.patterns.some((pattern) => combined.endsWith(pattern));
      const nextHistory = detected && !specification.overlap
        ? ""
        : longestStateSuffix(combined, states);
      return {
        nextStateIndex: Math.max(0, states.indexOf(nextHistory)),
        output: specification.model === "mealy"
          ? (detected ? "1" : "0")
          : null,
      };
    });
  });

  const stateOutputs = states.map((history) => {
    return specification.patterns.some((pattern) => history.endsWith(pattern)) ? "1" : "0";
  });

  return {
    states,
    transitions,
    stateOutputs,
  };
}

function longestStateSuffix(history, states) {
  return [...states]
    .filter((state) => history.endsWith(state))
    .sort((a, b) => b.length - a.length)[0] ?? "";
}

function applyGeneratedMachine(machine, specification) {
  machine.transitions.forEach((transitions, stateIndex) => {
    transitions.forEach((transition, inputIndex) => {
      const nextSelect = document.querySelector(
        `select[data-next][data-state-index="${stateIndex}"][data-input-index="${inputIndex}"]`,
      );
      if (nextSelect) {
        nextSelect.value = String(transition.nextStateIndex);
      }

      if (specification.model === "mealy") {
        const outputSelect = document.querySelector(
          `select[data-output][data-state-index="${stateIndex}"][data-input-index="${inputIndex}"]`,
        );
        if (outputSelect) {
          outputSelect.value = transition.output;
        }
      }
    });

    if (specification.model === "moore") {
      const outputSelect = document.querySelector(
        `select[data-output][data-state-index="${stateIndex}"]`,
      );
      if (outputSelect) {
        outputSelect.value = machine.stateOutputs[stateIndex];
      }
    }
  });
}

function analyzeTable() {
  const config = getConfig();
  const variables = [...config.qVars, ...config.xVars];
  const rows = collectRows(config);
  const unusedStateCodes = [];

  for (let stateIndex = config.stateCount; stateIndex < 2 ** config.stateBits; stateIndex += 1) {
    unusedStateCodes.push(stateIndex);
  }

  const functions = buildExcitationFunctions(config, variables, rows, unusedStateCodes);
  functions.push(buildOutputFunction(config, rows, unusedStateCodes));

  return {
    config,
    rows,
    functions: functions.map((fn) => ({
      ...fn,
      simplified: simplifyFunction(fn.variables, fn.minterms, fn.dontCares),
    })),
  };
}

function collectRows(config) {
  return config.states.flatMap((_, stateIndex) => {
    return config.inputs.map((inputBits, inputIndex) => {
      const nextSelect = document.querySelector(`select[data-next][data-state-index="${stateIndex}"][data-input-index="${inputIndex}"]`);
      const outputSelector = config.model === "mealy"
        ? `select[data-output][data-state-index="${stateIndex}"][data-input-index="${inputIndex}"]`
        : `select[data-output][data-state-index="${stateIndex}"]`;
      const outputSelect = document.querySelector(outputSelector);

      return {
        stateIndex,
        inputIndex,
        inputBits,
        nextStateIndex: Number(nextSelect.value),
        output: outputSelect.value,
      };
    });
  });
}

function buildExcitationFunctions(config, variables, rows, unusedStateCodes) {
  const functions = [];

  config.qVars.forEach((qVar, bitIndex) => {
    const suffix = qVar.replace("Q", "");
    const signalNames = excitationSignalNames(config.ffType, suffix);

    signalNames.forEach((signalName, signalPosition) => {
      const minterms = [];
      const dontCares = [];

      rows.forEach((row) => {
        const presentBits = toBits(row.stateIndex, config.stateBits);
        const nextBits = toBits(row.nextStateIndex, config.stateBits);
        const inputBits = toBits(row.inputIndex, config.inputBits);
        const excitation = excitationValues(config.ffType, presentBits[bitIndex], nextBits[bitIndex]);
        const value = excitation[signalPosition];
        const mintermIndex = parseInt([...presentBits, ...inputBits].join(""), 2);

        if (value === 1) {
          minterms.push(mintermIndex);
        } else if (value === "X") {
          dontCares.push(mintermIndex);
        }
      });

      unusedStateCodes.forEach((unusedState) => {
        config.inputs.forEach((_, inputIndex) => {
          const mintermIndex = parseInt(`${bitString(unusedState, config.stateBits)}${bitString(inputIndex, config.inputBits)}`, 2);
          dontCares.push(mintermIndex);
        });
      });

      functions.push({
        name: signalName,
        variables,
        minterms: uniqueSorted(minterms),
        dontCares: uniqueSorted(dontCares),
      });
    });
  });

  return functions;
}

function excitationSignalNames(ffType, suffix) {
  if (ffType === "D") {
    return [`D${suffix}`];
  }
  if (ffType === "T") {
    return [`T${suffix}`];
  }
  if (ffType === "SR") {
    return [`S${suffix}`, `R${suffix}`];
  }
  return [`J${suffix}`, `K${suffix}`];
}

function excitationValues(ffType, present, next) {
  if (ffType === "D") {
    return [next];
  }
  if (ffType === "T") {
    return [present ^ next];
  }
  if (ffType === "SR") {
    if (present === 0 && next === 0) return [0, "X"];
    if (present === 0 && next === 1) return [1, 0];
    if (present === 1 && next === 0) return [0, 1];
    return ["X", 0];
  }
  if (present === 0 && next === 0) return [0, "X"];
  if (present === 0 && next === 1) return [1, "X"];
  if (present === 1 && next === 0) return ["X", 1];
  return ["X", 0];
}

function buildOutputFunction(config, rows, unusedStateCodes) {
  if (config.model === "moore") {
    const stateOutputs = new Map();
    rows.forEach((row) => {
      if (!stateOutputs.has(row.stateIndex)) {
        stateOutputs.set(row.stateIndex, row.output);
      }
    });

    return {
      name: "Z",
      variables: config.qVars,
      minterms: uniqueSorted([...stateOutputs.entries()].filter(([, value]) => value === "1").map(([state]) => state)),
      dontCares: uniqueSorted([
        ...unusedStateCodes,
        ...[...stateOutputs.entries()].filter(([, value]) => value === "X").map(([state]) => state),
      ]),
    };
  }

  const minterms = rows
    .filter((row) => row.output === "1")
    .map((row) => parseInt(`${bitString(row.stateIndex, config.stateBits)}${bitString(row.inputIndex, config.inputBits)}`, 2));

  const dontCares = rows
    .filter((row) => row.output === "X")
    .map((row) => parseInt(`${bitString(row.stateIndex, config.stateBits)}${bitString(row.inputIndex, config.inputBits)}`, 2));

  unusedStateCodes.forEach((unusedState) => {
    config.inputs.forEach((_, inputIndex) => {
      dontCares.push(parseInt(`${bitString(unusedState, config.stateBits)}${bitString(inputIndex, config.inputBits)}`, 2));
    });
  });

  return {
    name: "Z",
    variables: [...config.qVars, ...config.xVars],
    minterms: uniqueSorted(minterms),
    dontCares: uniqueSorted(dontCares),
  };
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function simplifyFunction(variables, minterms, dontCares) {
  const mintermSet = new Set(minterms);
  if (minterms.length === 0) {
    return "0";
  }

  const allTerms = uniqueSorted([...minterms, ...dontCares]).map((value) => ({
    pattern: bitString(value, variables.length),
    covers: new Set([value]),
  }));

  const primes = findPrimeImplicants(allTerms);
  const usefulPrimes = uniquePatterns(primes)
    .map((prime) => ({
      pattern: prime.pattern,
      covers: coveredMinterms(prime.pattern, mintermSet, variables.length),
    }))
    .filter((prime) => prime.covers.size > 0);

  const selected = selectPrimeCover(usefulPrimes, minterms);
  return selected.map((prime) => patternToExpression(prime.pattern, variables)).join(" + ") || "0";
}

function findPrimeImplicants(initialTerms) {
  let terms = initialTerms;
  const primes = [];

  while (terms.length > 0) {
    const used = new Set();
    const nextTerms = [];

    for (let i = 0; i < terms.length; i += 1) {
      for (let j = i + 1; j < terms.length; j += 1) {
        const combined = combinePatterns(terms[i].pattern, terms[j].pattern);
        if (combined) {
          used.add(i);
          used.add(j);
          nextTerms.push({
            pattern: combined,
            covers: new Set([...terms[i].covers, ...terms[j].covers]),
          });
        }
      }
    }

    terms.forEach((term, index) => {
      if (!used.has(index)) {
        primes.push(term);
      }
    });

    terms = uniquePatterns(nextTerms);
  }

  return primes;
}

function combinePatterns(a, b) {
  let diff = 0;
  let combined = "";

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] === b[index]) {
      combined += a[index];
    } else if (a[index] !== "-" && b[index] !== "-") {
      diff += 1;
      combined += "-";
    } else {
      return null;
    }
  }

  return diff === 1 ? combined : null;
}

function uniquePatterns(terms) {
  const map = new Map();
  terms.forEach((term) => {
    if (!map.has(term.pattern)) {
      map.set(term.pattern, term);
    }
  });
  return [...map.values()];
}

function coveredMinterms(pattern, mintermSet, variableCount) {
  const covered = new Set();
  mintermSet.forEach((minterm) => {
    if (patternMatches(pattern, bitString(minterm, variableCount))) {
      covered.add(minterm);
    }
  });
  return covered;
}

function patternMatches(pattern, bits) {
  return [...pattern].every((bit, index) => bit === "-" || bit === bits[index]);
}

function selectPrimeCover(primes, minterms) {
  const uncovered = new Set(minterms);
  const selected = [];

  minterms.forEach((minterm) => {
    const covering = primes.filter((prime) => prime.covers.has(minterm));
    if (covering.length === 1 && !selected.includes(covering[0])) {
      selected.push(covering[0]);
      covering[0].covers.forEach((covered) => uncovered.delete(covered));
    }
  });

  if (uncovered.size === 0) {
    return sortImplicants(selected);
  }

  const remainingPrimes = primes.filter((prime) => !selected.includes(prime));
  let best = null;
  const totalCombinations = 2 ** remainingPrimes.length;

  for (let mask = 1; mask < totalCombinations; mask += 1) {
    const trial = [];
    const trialCovered = new Set();

    remainingPrimes.forEach((prime, index) => {
      if (mask & (1 << index)) {
        trial.push(prime);
        prime.covers.forEach((covered) => trialCovered.add(covered));
      }
    });

    const coversAll = [...uncovered].every((minterm) => trialCovered.has(minterm));
    if (!coversAll) {
      continue;
    }

    const score = coverScore(trial);
    if (!best || score.implicants < best.score.implicants || (score.implicants === best.score.implicants && score.literals < best.score.literals)) {
      best = { trial, score };
    }
  }

  return sortImplicants([...selected, ...(best ? best.trial : [])]);
}

function coverScore(primes) {
  return {
    implicants: primes.length,
    literals: primes.reduce((sum, prime) => sum + literalCount(prime.pattern), 0),
  };
}

function literalCount(pattern) {
  return [...pattern].filter((bit) => bit !== "-").length;
}

function sortImplicants(primes) {
  return [...primes].sort((a, b) => literalCount(a.pattern) - literalCount(b.pattern) || a.pattern.localeCompare(b.pattern));
}

function patternToExpression(pattern, variables) {
  if ([...pattern].every((bit) => bit === "-")) {
    return "1";
  }

  return [...pattern].map((bit, index) => {
    if (bit === "-") return "";
    return bit === "1" ? variables[index] : `${variables[index]}'`;
  }).filter(Boolean).join("");
}

function renderResults(analysis) {
  const { config, functions } = analysis;
  const stack = document.createElement("div");
  stack.className = "result-stack";

  const summary = document.createElement("div");
  summary.className = "summary-grid";
  summary.innerHTML = `
    <div class="summary-item"><span class="summary-label">模型</span><span class="summary-value">${config.model === "mealy" ? "Mealy" : "Moore"}</span></div>
    <div class="summary-item"><span class="summary-label">正反器</span><span class="summary-value">${config.ffType}-FF</span></div>
    <div class="summary-item"><span class="summary-label">變數</span><span class="summary-value">${[...config.qVars, ...config.xVars].join(", ")}</span></div>
  `;
  stack.appendChild(summary);
  stack.appendChild(renderStateDiagram(analysis));

  functions.forEach((fn) => {
    stack.appendChild(renderFunctionCard(fn));
  });
  stack.appendChild(renderCircuitDiagram(analysis));

  results.className = "";
  results.replaceChildren(stack);
}

function renderStateDiagram(analysis) {
  const card = document.createElement("section");
  card.className = "state-diagram-card";

  const heading = document.createElement("div");
  heading.className = "diagram-heading";
  const headingText = document.createElement("div");
  headingText.innerHTML = `
    <div>
      <p class="eyebrow">State Diagram</p>
      <h3>狀態轉移圖</h3>
    </div>
  `;

  const viewport = document.createElement("div");
  viewport.className = "state-diagram-viewport";
  const svg = buildStateDiagramSvg(analysis);
  viewport.appendChild(svg);

  const tools = document.createElement("div");
  tools.className = "diagram-tools";
  tools.innerHTML = `<span class="chip">${analysis.config.model === "mealy" ? "x / Z" : "Moore output"}</span>`;
  tools.appendChild(createZoomControls(
    viewport,
    svg,
    analysis.config.stateCount > 4 ? 1040 : 900,
  ));
  heading.replaceChildren(headingText, tools);
  card.appendChild(heading);
  card.appendChild(viewport);
  return card;
}

function buildStateDiagramSvg(analysis) {
  const { config, rows } = analysis;
  const { width, height } = stateDiagramDimensions(config.stateCount);
  const radius = config.stateCount > 4 ? 48 : 54;
  const positions = stateDiagramPositions(config.stateCount, width, height);
  const svg = svgNode("svg", {
    class: "state-diagram-svg",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `${config.model === "mealy" ? "Mealy" : "Moore"} 狀態轉移圖`,
  });

  const defs = svgNode("defs");
  const marker = svgNode("marker", {
    id: "state-arrow",
    viewBox: "0 0 10 10",
    refX: 9,
    refY: 5,
    markerWidth: 7,
    markerHeight: 7,
    orient: "auto-start-reverse",
  });
  marker.appendChild(svgNode("path", {
    d: "M 0 0 L 10 5 L 0 10 Z",
    class: "state-arrow-head",
  }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const edgeLayer = svgNode("g", { class: "state-edges" });
  const nodeLayer = svgNode("g", { class: "state-nodes" });
  const labelLayer = svgNode("g", { class: "state-labels" });
  svg.append(edgeLayer, nodeLayer, labelLayer);

  const groupedTransitions = groupStateTransitions(config, rows);
  const geometries = groupedTransitions.map((transition) => {
    return createStateTransitionGeometry(
      transition,
      positions,
      radius,
      groupedTransitions,
      width,
      height,
    );
  });
  const nodeBoxes = positions.map((position) => centeredBox(
    position.x,
    position.y,
    radius * 2 + 18,
    radius * 2 + 18,
  ));
  const usedLabelBoxes = [];
  geometries.forEach((geometry) => {
    drawStateTransitionEdge(geometry, edgeLayer);
  });
  geometries.forEach((geometry) => {
    drawStateTransitionLabel(
      geometry,
      geometries,
      usedLabelBoxes,
      nodeBoxes,
      { width, height },
      labelLayer,
    );
  });

  const first = positions[0];
  edgeLayer.appendChild(svgNode("path", {
    d: `M ${first.x - radius - 80} ${first.y} L ${first.x - radius - 7} ${first.y}`,
    class: "state-edge initial-state-edge",
    "marker-end": "url(#state-arrow)",
  }));
  labelLayer.appendChild(svgText(first.x - radius - 88, first.y + 5, "START", "state-start-label", "end"));

  config.states.forEach((stateName, index) => {
    const position = positions[index];
    const group = svgNode("g", {
      class: "state-node",
      "data-state-index": index,
      tabindex: 0,
      role: "button",
      "aria-label": `State ${stateName}`,
    });
    group.appendChild(svgNode("circle", {
      cx: position.x,
      cy: position.y,
      r: radius,
    }));
    group.appendChild(svgText(position.x, position.y - 5, stateName, "state-node-name"));
    group.appendChild(svgText(
      position.x,
      position.y + 19,
      bitString(index, config.stateBits),
      "state-node-code",
    ));

    if (config.model === "moore") {
      const output = rows.find((row) => row.stateIndex === index)?.output ?? "0";
      group.appendChild(svgText(position.x, position.y + 39, `Z=${output}`, "state-node-output"));
    }
    nodeLayer.appendChild(group);
  });

  bindStateDiagramInteractions(svg);
  return svg;
}

function stateDiagramDimensions(stateCount) {
  return stateCount > 4
    ? { width: 1240, height: 760 }
    : { width: 1100, height: 640 };
}

function stateDiagramPositions(stateCount, width, height) {
  if (stateCount === 2) {
    return [
      { x: 250, y: 320 },
      { x: 850, y: 320 },
    ];
  }

  if (stateCount === 3) {
    return [
      { x: 550, y: 120 },
      { x: 220, y: 500 },
      { x: 880, y: 500 },
    ];
  }

  if (stateCount === 4) {
    return [
      { x: 220, y: 150 },
      { x: 880, y: 150 },
      { x: 880, y: 490 },
      { x: 220, y: 490 },
    ];
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = width / 2 - 150;
  const radiusY = height / 2 - 120;
  return Array.from({ length: stateCount }, (_, index) => {
    const angle = Math.PI + index * (Math.PI * 2 / stateCount);
    return {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
  });
}

function groupStateTransitions(config, rows) {
  const groups = new Map();

  rows.forEach((row) => {
    const key = `${row.stateIndex}-${row.nextStateIndex}`;
    if (!groups.has(key)) {
      groups.set(key, {
        from: row.stateIndex,
        to: row.nextStateIndex,
        labels: [],
      });
    }

    const label = config.model === "mealy"
      ? `${row.inputBits}/${row.output}`
      : row.inputBits;
    groups.get(key).labels.push(label);
  });

  return [...groups.values()].map((transition) => ({
    ...transition,
    label: transition.labels.join(", "),
  }));
}

function createStateTransitionGeometry(
  transition,
  positions,
  radius,
  transitions,
  diagramWidth,
  diagramHeight,
) {
  const from = positions[transition.from];
  const to = positions[transition.to];

  if (transition.from === transition.to) {
    const outward = normalizeVector(
      from.x - diagramWidth / 2,
      from.y - diagramHeight / 2,
    );
    const tangent = { x: -outward.y, y: outward.x };
    const loopDepth = 94;
    const loopSpread = 82;
    const edgeOffset = radius * 0.72;
    const edgeSpread = radius * 0.5;
    const start = {
      x: from.x + outward.x * edgeOffset - tangent.x * edgeSpread,
      y: from.y + outward.y * edgeOffset - tangent.y * edgeSpread,
    };
    const end = {
      x: from.x + outward.x * edgeOffset + tangent.x * edgeSpread,
      y: from.y + outward.y * edgeOffset + tangent.y * edgeSpread,
    };
    const control1 = {
      x: from.x + outward.x * (radius + loopDepth) - tangent.x * loopSpread,
      y: from.y + outward.y * (radius + loopDepth) - tangent.y * loopSpread,
    };
    const control2 = {
      x: from.x + outward.x * (radius + loopDepth) + tangent.x * loopSpread,
      y: from.y + outward.y * (radius + loopDepth) + tangent.y * loopSpread,
    };
    const d = `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`;
    const samples = Array.from({ length: 13 }, (_, index) => {
      const t = index / 12;
      return cubicBezierPoint(
        start,
        control1,
        control2,
        end,
        t,
      );
    });
    const labelCenter = {
      x: from.x + outward.x * (radius + loopDepth + 30),
      y: from.y + outward.y * (radius + loopDepth + 30),
    };
    return {
      transition,
      d,
      samples,
      candidates: [
        labelCenter,
        {
          x: labelCenter.x - tangent.x * 54,
          y: labelCenter.y - tangent.y * 54,
        },
        {
          x: labelCenter.x + tangent.x * 54,
          y: labelCenter.y + tangent.y * 54,
        },
      ],
    };
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const ux = dx / distance;
  const uy = dy / distance;
  const perpendicularX = -uy;
  const perpendicularY = ux;
  const hasReverse = transitions.some((item) => item.from === transition.to && item.to === transition.from);
  const isDiagonal = Math.abs(dx) > 80 && Math.abs(dy) > 80;
  // The perpendicular vector already reverses with the transition direction.
  // Keeping the same positive offset sends reciprocal transitions to opposite lanes.
  const curveOffset = hasReverse ? (isDiagonal ? 54 : 78) : 0;
  const controlX = (from.x + to.x) / 2 + perpendicularX * curveOffset;
  const controlY = (from.y + to.y) / 2 + perpendicularY * curveOffset;
  const startDirection = normalizeVector(controlX - from.x, controlY - from.y);
  const endDirection = normalizeVector(controlX - to.x, controlY - to.y);
  const startX = from.x + startDirection.x * radius;
  const startY = from.y + startDirection.y * radius;
  const endX = to.x + endDirection.x * (radius + 8);
  const endY = to.y + endDirection.y * (radius + 8);

  const samples = Array.from({ length: 13 }, (_, index) => {
    const t = index / 12;
    return quadraticBezierPoint(
      { x: startX, y: startY },
      { x: controlX, y: controlY },
      { x: endX, y: endY },
      t,
    );
  });
  const pathPoints = [0.5, 0.38, 0.62].map((t) => quadraticBezierPoint(
    { x: startX, y: startY },
    { x: controlX, y: controlY },
    { x: endX, y: endY },
    t,
  ));
  const offsets = hasReverse
    ? [30, 48, 68, -30, -48, -68, 88, -88]
    : [28, -28, 46, -46, 64, -64, 84, -84];

  return {
    transition,
    d: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
    samples,
    candidates: pathPoints.flatMap((point) => offsets.map((offset) => ({
      x: point.x + perpendicularX * offset,
      y: point.y + perpendicularY * offset,
    }))),
  };
}

function drawStateTransitionEdge(geometry, edgeLayer) {
  edgeLayer.appendChild(svgNode("path", {
    d: geometry.d,
    class: "state-edge state-transition",
    "data-from": geometry.transition.from,
    "data-to": geometry.transition.to,
    "marker-end": "url(#state-arrow)",
  }));
}

function drawStateTransitionLabel(
  geometry,
  allGeometries,
  usedBoxes,
  nodeBoxes,
  diagramBounds,
  labelLayer,
) {
  const width = Math.max(42, geometry.transition.label.length * 8 + 18);
  const height = 24;
  const rankedCandidates = geometry.candidates.map((candidate, index) => {
    const box = centeredBox(candidate.x, candidate.y, width, height);
    return {
      candidate,
      box,
      score: scoreStateLabelBox(
        box,
        geometry,
        allGeometries,
        usedBoxes,
        nodeBoxes,
        diagramBounds,
        index,
      ),
    };
  }).sort((a, b) => a.score - b.score);
  const selectedLayout = rankedCandidates[0];
  const selected = selectedLayout.candidate;

  const box = selectedLayout.box;
  usedBoxes.push(box);
  const group = svgNode("g", {
    class: "state-edge-label-group",
    "data-from": geometry.transition.from,
    "data-to": geometry.transition.to,
  });
  group.appendChild(svgNode("rect", {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rx: 5,
  }));
  group.appendChild(svgText(selected.x, selected.y + 5, geometry.transition.label, "state-edge-label"));
  labelLayer.appendChild(group);
}

function scoreStateLabelBox(
  box,
  geometry,
  allGeometries,
  usedBoxes,
  nodeBoxes,
  diagramBounds,
  preference,
) {
  let score = preference * 0.15;

  if (
    box.x < 8
    || box.y < 8
    || box.x + box.width > diagramBounds.width - 8
    || box.y + box.height > diagramBounds.height - 8
  ) {
    score += 100000;
  }

  usedBoxes.forEach((used) => {
    if (boxesOverlap(box, used, 10)) {
      score += 100000 + boxOverlapArea(box, used) * 100;
    }
  });

  nodeBoxes.forEach((nodeBox) => {
    if (boxesOverlap(box, nodeBox, 8)) {
      score += 80000 + boxOverlapArea(box, nodeBox) * 50;
    }
  });

  allGeometries.forEach((other) => {
    const clearance = other === geometry ? 9 : 12;
    const nearest = Math.min(...other.samples.map((point) => pointToBoxDistance(point, box)));
    if (nearest < clearance) {
      score += (clearance - nearest + 1) * (other === geometry ? 5000 : 7500);
    }
  });

  return score;
}

function centeredBox(x, y, width, height) {
  return {
    x: x - width / 2,
    y: y - height / 2,
    width,
    height,
  };
}

function boxesOverlap(a, b, padding = 0) {
  return a.x < b.x + b.width + padding
    && a.x + a.width + padding > b.x
    && a.y < b.y + b.height + padding
    && a.y + a.height + padding > b.y;
}

function boxOverlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function pointToBoxDistance(point, box) {
  const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.width));
  const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.height));
  return Math.hypot(dx, dy);
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y) || 1;
  return {
    x: x / length,
    y: y / length,
  };
}

function quadraticBezierPoint(start, control, end, t) {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}

function cubicBezierPoint(start, control1, control2, end, t) {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * start.x
      + 3 * inverse * inverse * t * control1.x
      + 3 * inverse * t * t * control2.x
      + t ** 3 * end.x,
    y: inverse ** 3 * start.y
      + 3 * inverse * inverse * t * control1.y
      + 3 * inverse * t * t * control2.y
      + t ** 3 * end.y,
  };
}

function bindStateDiagramInteractions(svg) {
  const nodes = svg.querySelectorAll(".state-node");

  const clearFocus = () => {
    svg.classList.remove("has-state-focus");
    svg.querySelectorAll(".is-active-state, .is-next-state, .is-active-transition").forEach((element) => {
      element.classList.remove("is-active-state", "is-next-state", "is-active-transition");
    });
  };

  const showState = (stateIndex) => {
    clearFocus();
    svg.classList.add("has-state-focus");
    svg.querySelector(`.state-node[data-state-index="${stateIndex}"]`)?.classList.add("is-active-state");

    svg.querySelectorAll(`.state-transition[data-from="${stateIndex}"], .state-edge-label-group[data-from="${stateIndex}"]`).forEach((element) => {
      element.classList.add("is-active-transition");
      const targetIndex = element.dataset.to;
      svg.querySelector(`.state-node[data-state-index="${targetIndex}"]`)?.classList.add("is-next-state");
    });
  };

  svg.addEventListener("mouseover", (event) => {
    const node = event.target.closest?.(".state-node");
    if (!node || node.contains(event.relatedTarget)) return;
    showState(node.dataset.stateIndex);
  });

  svg.addEventListener("mouseout", (event) => {
    const node = event.target.closest?.(".state-node");
    if (!node || node.contains(event.relatedTarget)) return;
    clearFocus();
  });

  nodes.forEach((node) => {
    const stateIndex = node.dataset.stateIndex;
    node.addEventListener("focus", () => showState(stateIndex));
    node.addEventListener("blur", clearFocus);
  });
}

function renderFunctionCard(fn) {
  const card = document.createElement("article");
  card.className = "function-card";
  card.innerHTML = `
    <h3>${fn.name}(${fn.variables.join(", ")})</h3>
    <div class="function-meta">
      <span class="chip">m = ${formatSet(fn.minterms)}</span>
      <span class="chip">d = ${formatSet(fn.dontCares)}</span>
    </div>
    <div class="equation">${fn.name} = ${fn.simplified}</div>
  `;
  card.appendChild(renderKMap(fn));
  return card;
}

function renderCircuitDiagram(analysis) {
  const card = document.createElement("section");
  card.className = "circuit-card";

  const heading = document.createElement("div");
  heading.className = "circuit-heading";
  const headingText = document.createElement("div");
  headingText.innerHTML = `
    <div>
      <p class="eyebrow">Gate-Level Circuit</p>
      <h3>自動產生電路圖</h3>
    </div>
  `;

  const viewport = document.createElement("div");
  viewport.className = "circuit-viewport";
  const svg = buildCircuitSvg(analysis);
  viewport.appendChild(svg);

  const tools = document.createElement("div");
  tools.className = "diagram-tools";
  tools.innerHTML = `<span class="chip">${analysis.config.ffType}-FF</span>`;
  tools.appendChild(createZoomControls(viewport, svg, 1040));
  heading.replaceChildren(headingText, tools);
  card.appendChild(heading);
  card.appendChild(viewport);
  return card;
}

function createZoomControls(viewport, svg, minimumWidth) {
  const controls = document.createElement("div");
  controls.className = "zoom-controls";
  controls.setAttribute("aria-label", "圖形縮放");
  let zoom = 1;

  const zoomOut = createZoomButton("-", "縮小");
  const reset = createZoomButton("1:1", "重設縮放");
  const zoomIn = createZoomButton("+", "放大");

  const applyZoom = () => {
    svg.style.width = `${zoom * 100}%`;
    svg.style.minWidth = `${minimumWidth * zoom}px`;
    reset.textContent = `${Math.round(zoom * 100)}%`;
    viewport.dataset.zoom = String(zoom);
  };

  zoomOut.addEventListener("click", () => {
    zoom = Math.max(0.6, Number((zoom - 0.2).toFixed(1)));
    applyZoom();
  });
  reset.addEventListener("click", () => {
    zoom = 1;
    applyZoom();
  });
  zoomIn.addEventListener("click", () => {
    zoom = Math.min(2, Number((zoom + 0.2).toFixed(1)));
    applyZoom();
  });

  controls.append(zoomOut, reset, zoomIn);
  applyZoom();
  return controls;
}

function createZoomButton(text, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "zoom-button";
  button.textContent = text;
  button.title = label;
  button.setAttribute("aria-label", label);
  return button;
}

function buildCircuitSvg(analysis) {
  const parsedFunctions = analysis.functions.map((fn) => ({
    ...fn,
    circuit: parseCircuitExpression(fn.simplified, fn.variables),
  }));
  const layout = createCircuitLayout(analysis.config, parsedFunctions);
  const svg = svgNode("svg", {
    class: "circuit-svg",
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    role: "img",
    "aria-label": `${analysis.config.ffType} 正反器狀態電路圖`,
  });

  const wireLayer = svgNode("g", { class: "circuit-wires" });
  const nodeLayer = svgNode("g", { class: "circuit-nodes" });
  const labelLayer = svgNode("g", { class: "circuit-labels" });
  svg.append(wireLayer, nodeLayer, labelLayer);

  drawSignalRails(layout, parsedFunctions, wireLayer, nodeLayer, labelLayer);

  layout.functionLayouts.forEach((fnLayout) => {
    drawFunctionCircuit(fnLayout, layout, wireLayer, nodeLayer, labelLayer);
  });

  drawFlipFlops(layout, analysis.config, wireLayer, nodeLayer, labelLayer);
  drawClockNetwork(layout, wireLayer, nodeLayer, labelLayer);
  drawFeedbackWires(layout, analysis.config, wireLayer, nodeLayer);
  return svg;
}

function parseCircuitExpression(expression, variables) {
  if (expression === "0" || expression === "1") {
    return { type: "constant", value: expression, terms: [] };
  }

  const orderedVariables = [...variables].sort((a, b) => b.length - a.length);
  const terms = expression.split(" + ").map((term) => {
    const literals = [];
    let position = 0;

    while (position < term.length) {
      const variable = orderedVariables.find((name) => term.startsWith(name, position));
      if (!variable) {
        position += 1;
        continue;
      }

      position += variable.length;
      const inverted = term[position] === "'";
      if (inverted) {
        position += 1;
      }
      literals.push({ variable, inverted });
    }

    return literals;
  });

  const xorVariables = detectXorTerms(terms);
  if (xorVariables) {
    return { type: "xor", variables: xorVariables, terms };
  }

  return { type: "sop", terms };
}

function detectXorTerms(terms) {
  if (terms.length !== 2 || terms.some((term) => term.length !== 2)) {
    return null;
  }

  const first = [...terms[0]].sort((a, b) => a.variable.localeCompare(b.variable));
  const second = [...terms[1]].sort((a, b) => a.variable.localeCompare(b.variable));
  const sameVariables = first.every((literal, index) => literal.variable === second[index].variable);
  const oppositePolarity = first.every((literal, index) => literal.inverted !== second[index].inverted);

  if (!sameVariables || !oppositePolarity || first[0].inverted === first[1].inverted) {
    return null;
  }

  return first.map((literal) => literal.variable);
}

function createCircuitLayout(config, functions) {
  const width = 1220;
  const top = 130;
  const gap = 34;
  let cursorY = top;

  const functionLayouts = functions.map((fn) => {
    const termRows = placeTermRows(fn.circuit, cursorY);
    const contentBottom = termRows.length
      ? termRows[termRows.length - 1].bottom
      : cursorY + 82;
    const height = Math.max(112, contentBottom - cursorY + 26);
    const centerY = termRows.length
      ? (termRows[0].centerY + termRows[termRows.length - 1].centerY) / 2
      : cursorY + height / 2;
    const layout = {
      ...fn,
      top: cursorY,
      height,
      centerY,
      termRows,
    };
    cursorY += height + gap;
    return layout;
  });

  const logicBottom = cursorY;
  const clockBusY = logicBottom + 28;
  const clockTrunkX = 1092;
  const feedbackBaseY = clockBusY + 42;
  const height = feedbackBaseY + config.qVars.length * 28 + 62;
  const railStartX = 54;
  const railSpacing = 70;
  const rails = new Map();

  [...config.qVars, ...config.xVars].forEach((variable, index) => {
    const trueX = railStartX + index * railSpacing;
    rails.set(variable, {
      trueX,
      invertedX: trueX + 30,
    });
  });

  const ffGroups = config.qVars.map((qVar, bitIndex) => {
    const suffix = qVar.replace("Q", "");
    const inputs = functionLayouts.filter((fn) => fn.name !== "Z" && fn.name.endsWith(suffix));
    const topY = Math.min(...inputs.map((fn) => fn.centerY)) - 58;
    const bottomY = Math.max(...inputs.map((fn) => fn.centerY)) + 58;
    const boxHeight = Math.max(116, bottomY - topY);
    const boxCenter = topY + boxHeight / 2;

    return {
      qVar,
      suffix,
      bitIndex,
      inputs,
      x: 936,
      y: topY,
      width: 132,
      height: boxHeight,
      outputY: boxCenter - 15,
      invertedOutputY: boxCenter + 15,
      clockX: 936 + 66,
      clockY: topY + boxHeight,
      feedbackX: 1120 + bitIndex * 28,
      feedbackY: feedbackBaseY + bitIndex * 28,
    };
  });

  return {
    width,
    height,
    top,
    logicBottom,
    clockBusY,
    clockTrunkX,
    feedbackBaseY,
    rails,
    ffGroups,
    functionLayouts,
    railBottom: feedbackBaseY + config.qVars.length * 28,
  };
}

function placeTermRows(circuit, functionTop) {
  if (circuit.type !== "sop") {
    return [{
      top: functionTop + 42,
      bottom: functionTop + 98,
      centerY: functionTop + 70,
      gateHeight: 56,
    }];
  }

  const minimumGap = 20;
  let nextTop = functionTop + 42;
  const rows = [];

  circuit.terms.forEach((term) => {
    const gateHeight = term.length > 1
      ? Math.max(46, term.length * 18 + 16)
      : 26;
    let top = nextTop;
    const previous = rows[rows.length - 1];
    const candidate = { top, bottom: top + gateHeight };

    if (previous && gateBoxesTouch(previous, candidate, minimumGap)) {
      top = previous.bottom + minimumGap;
    }

    const bottom = top + gateHeight;
    nextTop = bottom + minimumGap;

    rows.push({
      top,
      bottom,
      centerY: top + gateHeight / 2,
      gateHeight,
    });
  });

  return rows;
}

function gateBoxesTouch(first, second, clearance) {
  return second.top <= first.bottom + clearance;
}

function drawSignalRails(layout, functions, wireLayer, nodeLayer, labelLayer) {
  const neededInverted = new Set();
  functions.forEach((fn) => {
    if (fn.circuit.type === "xor") {
      return;
    }
    fn.circuit.terms.forEach((term) => {
      term.filter((literal) => literal.inverted).forEach((literal) => {
        neededInverted.add(literal.variable);
      });
    });
  });

  layout.rails.forEach((rail, variable) => {
    addWire(wireLayer, [
      [rail.trueX, 78],
      [rail.trueX, layout.railBottom],
    ], "signal-rail");

    if (variable.startsWith("X")) {
      labelLayer.appendChild(svgText(rail.trueX, 60, variable, "source-label"));
      nodeLayer.appendChild(svgNode("circle", {
        cx: rail.trueX,
        cy: 78,
        r: 4,
        class: "input-terminal",
      }));
    }

    if (neededInverted.has(variable)) {
      drawNotGate(nodeLayer, rail.trueX + 6, 70, 20, 18);
      addWire(wireLayer, [
        [rail.trueX, 79],
        [rail.trueX + 6, 79],
      ]);
      addWire(wireLayer, [
        [rail.trueX + 26, 79],
        [rail.invertedX, 79],
        [rail.invertedX, layout.logicBottom - 10],
      ], "signal-rail");
    }
  });
}

function drawFunctionCircuit(fn, layout, wireLayer, nodeLayer, labelLayer) {
  const target = functionTarget(fn, layout);
  nodeLayer.appendChild(svgNode("rect", {
    x: 302,
    y: fn.top + 2,
    width: 520,
    height: 28,
    rx: 3,
    class: "function-label-bg",
  }));
  labelLayer.appendChild(svgText(318, fn.top + 20, `${fn.name} = ${fn.simplified}`, "function-label", "start"));

  if (fn.circuit.type === "constant") {
    const constantX = 690;
    drawConstantNode(nodeLayer, labelLayer, constantX, fn.centerY, fn.circuit.value);
    addWire(wireLayer, [
      [constantX + 22, fn.centerY],
      [target.x, fn.centerY],
      [target.x, target.y],
    ], fn.name === "Z" ? "output-wire" : "");
    drawFunctionTarget(fn, target, nodeLayer, labelLayer);
    return;
  }

  if (fn.circuit.type === "xor") {
    const gate = { x: 574, y: fn.centerY - 28, width: 78, height: 56 };
    const inputYs = [fn.centerY - 12, fn.centerY + 12];
    fn.circuit.variables.forEach((variable, index) => {
      connectLiteralToPoint({ variable, inverted: false }, gate.x + 34, inputYs[index], layout, wireLayer, nodeLayer);
    });
    drawXorGate(nodeLayer, gate.x, gate.y, gate.width, gate.height);
    addWire(wireLayer, [
      [gate.x + gate.width, fn.centerY],
      [target.x, fn.centerY],
      [target.x, target.y],
    ], fn.name === "Z" ? "output-wire" : "");
    drawFunctionTarget(fn, target, nodeLayer, labelLayer);
    return;
  }

  const terms = fn.circuit.terms;
  const termOutputs = [];

  terms.forEach((term, termIndex) => {
    const row = fn.termRows[termIndex];
    const termY = row.centerY;

    if (term.length <= 1) {
      const literal = term[0];
      termOutputs.push({
        x: literal ? literalRailX(literal, layout) : 420,
        y: termY,
        literal,
      });
      return;
    }

    const gate = {
      x: 468,
      y: row.top,
      width: 74,
      height: row.gateHeight,
    };
    const inputYs = distributePins(gate.y, gate.height, term.length);
    term.forEach((literal, index) => {
      connectLiteralToPoint(literal, gate.x, inputYs[index], layout, wireLayer, nodeLayer);
    });
    drawAndGate(nodeLayer, gate.x, gate.y, gate.width, gate.height);
    termOutputs.push({ x: gate.x + gate.width, y: termY });
  });

  if (terms.length > 1) {
    const orGate = {
      x: 660,
      y: fn.centerY - Math.max(29, terms.length * 10),
      width: 78,
      height: Math.max(58, terms.length * 20),
    };
    const orInputs = distributePins(orGate.y, orGate.height, terms.length);
    const orInputOverlapX = orGate.x + 34;
    termOutputs.forEach((output, index) => {
      if (output.literal) {
        connectLiteralToPoint(output.literal, orInputOverlapX, orInputs[index], layout, wireLayer, nodeLayer);
      } else {
        addWire(wireLayer, [
          [output.x, output.y],
          [596 + index * 10, output.y],
          [596 + index * 10, orInputs[index]],
          [orInputOverlapX, orInputs[index]],
        ]);
      }
    });
    drawOrGate(nodeLayer, orGate.x, orGate.y, orGate.width, orGate.height);
    addWire(wireLayer, [
      [orGate.x + orGate.width, fn.centerY],
      [target.x, fn.centerY],
      [target.x, target.y],
    ], fn.name === "Z" ? "output-wire" : "");
  } else {
    const output = termOutputs[0];
    if (output.literal) {
      connectLiteralToPoint(output.literal, target.x, target.y, layout, wireLayer, nodeLayer);
    } else {
      addWire(wireLayer, [
        [output.x, output.y],
        [target.x, output.y],
        [target.x, target.y],
      ], fn.name === "Z" ? "output-wire" : "");
    }
  }

  drawFunctionTarget(fn, target, nodeLayer, labelLayer);
}

function functionTarget(fn, layout) {
  if (fn.name === "Z") {
    return { x: 870, y: fn.centerY, type: "output" };
  }

  return { x: 936, y: fn.centerY, type: "ff-input" };
}

function drawFunctionTarget(fn, target, nodeLayer, labelLayer) {
  if (target.type !== "output") {
    return;
  }

  nodeLayer.appendChild(svgNode("circle", {
    cx: target.x,
    cy: target.y,
    r: 5,
    class: "output-terminal",
  }));
  labelLayer.appendChild(svgText(target.x + 18, target.y + 5, "Z", "output-label", "start"));
}

function connectLiteralToPoint(literal, targetX, targetY, layout, wireLayer, nodeLayer) {
  const sourceX = literalRailX(literal, layout);
  addWire(wireLayer, [
    [sourceX, targetY],
    [targetX, targetY],
  ]);
  nodeLayer.appendChild(svgNode("circle", {
    cx: sourceX,
    cy: targetY,
    r: 3.5,
    class: "junction",
  }));
}

function literalRailX(literal, layout) {
  const rail = layout.rails.get(literal.variable);
  return literal.inverted ? rail.invertedX : rail.trueX;
}

function distributePins(y, height, count) {
  if (count === 1) {
    return [y + height / 2];
  }

  const padding = 12;
  const step = (height - padding * 2) / (count - 1);
  return Array.from({ length: count }, (_, index) => y + padding + index * step);
}

function drawFlipFlops(layout, config, wireLayer, nodeLayer, labelLayer) {
  layout.ffGroups.forEach((group) => {
    const box = svgNode("g", { class: "flip-flop" });
    box.appendChild(svgNode("rect", {
      x: group.x,
      y: group.y,
      width: group.width,
      height: group.height,
      rx: 4,
    }));
    box.appendChild(svgText(
      group.x + group.width / 2,
      group.y + group.height / 2 + 5,
      `${config.ffType}-FF`,
      "ff-title",
    ));

    const clockY = group.clockY;
    box.appendChild(svgNode("path", {
      d: `M ${group.clockX - 7} ${clockY} L ${group.clockX} ${clockY - 8} L ${group.clockX + 7} ${clockY}`,
      class: "clock-symbol",
    }));
    box.appendChild(svgNode("circle", {
      cx: group.clockX,
      cy: clockY,
      r: 3.5,
      class: "clock-pin",
    }));
    box.appendChild(svgText(group.clockX, clockY - 13, "CLK", "ff-clock-label"));

    group.inputs.forEach((fn) => {
      box.appendChild(svgNode("circle", {
        cx: group.x,
        cy: fn.centerY,
        r: 3.5,
        class: "ff-pin",
      }));
      box.appendChild(svgText(group.x + 10, fn.centerY + 4, fn.name.replace(group.suffix, ""), "ff-pin-label", "start"));
    });

    box.appendChild(svgNode("circle", {
      cx: group.x + group.width,
      cy: group.outputY,
      r: 4,
      class: "ff-output-pin",
    }));
    box.appendChild(svgText(group.x + group.width - 12, group.outputY + 4, "Q", "ff-pin-label", "end"));
    box.appendChild(svgNode("circle", {
      cx: group.x + group.width,
      cy: group.invertedOutputY,
      r: 4,
      class: "ff-output-pin",
    }));
    box.appendChild(svgText(group.x + group.width - 12, group.invertedOutputY + 4, "Q'", "ff-pin-label", "end"));
    const signalTag = {
      x: group.x + group.width + 4,
      y: group.y + 6,
      width: 36,
      height: 24,
    };
    box.appendChild(svgNode("rect", {
      x: signalTag.x,
      y: signalTag.y,
      width: signalTag.width,
      height: signalTag.height,
      rx: 4,
      class: "ff-output-tag",
    }));
    box.appendChild(svgText(
      signalTag.x + signalTag.width / 2,
      signalTag.y + 17,
      group.qVar,
      "ff-output-label",
    ));
    nodeLayer.appendChild(box);
  });
}

function drawClockNetwork(layout, wireLayer, nodeLayer, labelLayer) {
  const sourceX = 760;
  const branchYs = layout.ffGroups.map((group) => group.clockY + 16);
  const topBranchY = Math.min(...branchYs);
  addWire(wireLayer, [
    [sourceX, layout.clockBusY],
    [layout.clockTrunkX, layout.clockBusY],
    [layout.clockTrunkX, topBranchY],
  ], "clock-wire");

  layout.ffGroups.forEach((group, index) => {
    const branchY = branchYs[index];
    addWire(wireLayer, [
      [layout.clockTrunkX, branchY],
      [group.clockX, branchY],
      [group.clockX, group.clockY],
    ], "clock-wire");
    nodeLayer.appendChild(svgNode("circle", {
      cx: layout.clockTrunkX,
      cy: branchY,
      r: 3.5,
      class: "clock-junction",
    }));
  });

  nodeLayer.appendChild(svgNode("circle", {
    cx: sourceX,
    cy: layout.clockBusY,
    r: 4,
    class: "clock-source",
  }));
  labelLayer.appendChild(svgText(sourceX - 12, layout.clockBusY + 5, "CLK", "clock-source-label", "end"));
}

function drawFeedbackWires(layout, config, wireLayer, nodeLayer) {
  layout.ffGroups.forEach((group) => {
    const rail = layout.rails.get(group.qVar);
    addWire(wireLayer, [
      [group.x + group.width, group.outputY],
      [group.feedbackX, group.outputY],
      [group.feedbackX, group.feedbackY],
      [rail.trueX, group.feedbackY],
      [rail.trueX, layout.railBottom],
    ], "feedback-wire");
    nodeLayer.appendChild(svgNode("circle", {
      cx: rail.trueX,
      cy: group.feedbackY,
      r: 4,
      class: "feedback-junction",
    }));
  });
}

function drawAndGate(layer, x, y, width, height) {
  const flat = width * 0.42;
  const path = [
    `M ${x} ${y}`,
    `L ${x + flat} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + height / 2}`,
    `Q ${x + width} ${y + height} ${x + flat} ${y + height}`,
    `L ${x} ${y + height}`,
    "Z",
  ].join(" ");
  layer.appendChild(svgNode("path", { d: path, class: "logic-gate and-gate" }));
}

function drawOrGate(layer, x, y, width, height) {
  const path = [
    `M ${x} ${y}`,
    `Q ${x + width * 0.35} ${y + height / 2} ${x} ${y + height}`,
    `Q ${x + width * 0.68} ${y + height * 0.92} ${x + width} ${y + height / 2}`,
    `Q ${x + width * 0.68} ${y + height * 0.08} ${x} ${y}`,
    "Z",
  ].join(" ");
  layer.appendChild(svgNode("path", { d: path, class: "logic-gate or-gate" }));
}

function drawXorGate(layer, x, y, width, height) {
  drawOrGate(layer, x + 7, y, width - 7, height);
  const extra = [
    `M ${x} ${y}`,
    `Q ${x + width * 0.35} ${y + height / 2} ${x} ${y + height}`,
  ].join(" ");
  layer.appendChild(svgNode("path", { d: extra, class: "logic-gate no-fill" }));
}

function drawNotGate(layer, x, y, width, height) {
  layer.appendChild(svgNode("path", {
    d: `M ${x} ${y} L ${x} ${y + height} L ${x + width - 6} ${y + height / 2} Z`,
    class: "logic-gate",
  }));
  layer.appendChild(svgNode("circle", {
    cx: x + width - 3,
    cy: y + height / 2,
    r: 3,
    class: "inversion-bubble",
  }));
}

function drawConstantNode(nodeLayer, labelLayer, x, y, value) {
  nodeLayer.appendChild(svgNode("rect", {
    x,
    y: y - 18,
    width: 44,
    height: 36,
    rx: 4,
    class: "constant-node",
  }));
  labelLayer.appendChild(svgText(x + 22, y + 5, value, "constant-label"));
}

function addWire(layer, points, extraClass = "") {
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point[0]} ${point[1]}`).join(" ");
  layer.appendChild(svgNode("path", {
    d: path,
    class: `circuit-wire ${extraClass}`.trim(),
  }));
}

function svgText(x, y, text, className, anchor = "middle") {
  return svgNode("text", {
    x,
    y,
    class: className,
    "text-anchor": anchor,
  }, text);
}

function svgNode(tag, attributes = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, String(value));
  });
  if (text) {
    element.textContent = text;
  }
  return element;
}

function formatSet(values) {
  return values.length ? values.join(", ") : "none";
}

function renderKMap(fn) {
  const vars = fn.variables;
  const rowVarCount = Math.floor(vars.length / 2);
  const colVarCount = vars.length - rowVarCount;
  const rowCodes = grayCodes(rowVarCount);
  const colCodes = grayCodes(colVarCount);
  const mintermSet = new Set(fn.minterms);
  const dcSet = new Set(fn.dontCares);

  const wrap = document.createElement("div");
  wrap.className = "kmap-wrap";

  const table = document.createElement("table");
  table.className = "kmap";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  const rowLabel = vars.slice(0, rowVarCount).join("");
  const colLabel = vars.slice(rowVarCount).join("");
  corner.textContent = `${rowLabel || "1"} \\ ${colLabel || "1"}`;
  headRow.appendChild(corner);
  colCodes.forEach((code) => {
    const th = document.createElement("th");
    th.textContent = code || "0";
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rowCodes.forEach((rowCode) => {
    const tr = document.createElement("tr");
    const rowHead = document.createElement("th");
    rowHead.textContent = rowCode || "0";
    tr.appendChild(rowHead);

    colCodes.forEach((colCode) => {
      const bits = `${rowCode}${colCode}`;
      const minterm = parseInt(bits || "0", 2);
      const td = document.createElement("td");
      const isOne = mintermSet.has(minterm);
      const isDc = dcSet.has(minterm);
      td.className = `kmap-cell ${isOne ? "one" : isDc ? "dc" : "zero"}`;
      td.innerHTML = `${isOne ? "1" : isDc ? "X" : "0"}<span class="minterm-tag">m${minterm}</span>`;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function grayCodes(bitCount) {
  if (bitCount === 0) {
    return [""];
  }

  const total = 2 ** bitCount;
  return Array.from({ length: total }, (_, value) => {
    const gray = value ^ (value >> 1);
    return bitString(gray, bitCount);
  });
}

function clearResults() {
  results.className = "empty-results";
  results.textContent = "選擇模型與正反器，填入 next state 與輸出 Z 後按下執行。";
}

renderTable();
