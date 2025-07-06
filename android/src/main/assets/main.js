function createFromTemplate(id, params) {
  template = document.getElementById(id)
    .content
    .firstElementChild
    .cloneNode(true);

  for (const eid in params) {
    const element = template.querySelector(`[data-id="${eid}"]`);
    if (!element) {
      console.warn(
        `Element with data-id="${eid}" not found in template "${id}"`);
      continue;
    }

    eparams = params[eid];
    if (typeof eparams === "string") {
      element.textContent = eparams;
    } else {
      for (const eparam in eparams) {
        pvalue = eparams[eparam];
        switch (eparam) {
          case "text":
            element.textContent = pvalue;
            break;
          case "html":
            element.innerHTML = pvalue;
            break;
          case "events":
            for (const eventName in pvalue) {
              element.addEventListener(eventName, pvalue[eventName]);
            }
            break;
          default:
            attr = element.getAttribute(eparam);
            if (attr === null) {
              console.warn(
                `Attribute "${eparam}" not found for element ` +
                `with data-id="${eid}"`);
              continue;
            }
            element.setAttribute(eparam, pvalue);
        }
      }
    }
  }
  return template;
}

const summary = document.getElementById("summary");
summary.replaceChildren(createFromTemplate("summary-template", {
  title: "Summary",
  total: { text: "1234" },
}));

const newExpense = document.getElementById("new-expense");
newExpense.replaceChildren(createFromTemplate("new-expense-template", {
  cross: {
    events: {
      click: () => newExpense.replaceChildren()
    }
  },
  amount: {
    value: "",
  },
  description: {
    value: "",
  },
  date: {
    value: new Date().toISOString().split("T")[0],
  },
  categories: {
    value: "",
  },
}))
