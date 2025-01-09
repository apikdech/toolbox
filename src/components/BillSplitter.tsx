import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import type {
  Person,
  Item,
  DiscountSettings,
  AdditionalFee,
  BillSummary,
} from "../types/bill-split";

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/\s+/g, " ");
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat("id-ID").format(value);
};

const calculateDiscountedAmounts = (
  people: Person[],
  totalDiscount: number,
  minimumSpend: number
): { [key: string]: number } => {
  let discountedAmounts: { [key: string]: number } = {};
  let remainingDiscount = totalDiscount;
  let eligiblePeople = people.filter(
    (person) =>
      person.items.reduce((sum, item) => sum + item.price * item.quantity, 0) >
      0
  );

  // Keep iterating as long as there's remaining discount and eligible people
  while (remainingDiscount > 0 && eligiblePeople.length > 0) {
    const discountPerPerson = remainingDiscount / eligiblePeople.length;
    let unusedDiscount = 0;

    eligiblePeople.forEach((person) => {
      const subtotal = person.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const currentDiscount = discountedAmounts[person.id] || 0;
      const remainingSubtotal = subtotal - currentDiscount;

      if (remainingSubtotal > 0) {
        const appliedDiscount = Math.min(discountPerPerson, remainingSubtotal);
        discountedAmounts[person.id] =
          (discountedAmounts[person.id] || 0) + appliedDiscount;
        unusedDiscount += discountPerPerson - appliedDiscount;
      }
    });

    // Update remaining discount and eligible people for next iteration
    remainingDiscount = unusedDiscount;
    eligiblePeople = eligiblePeople.filter((person) => {
      const subtotal = person.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const currentDiscount = discountedAmounts[person.id] || 0;
      return subtotal - currentDiscount > 0;
    });
  }

  return discountedAmounts;
};

interface CompactPerson {
  n: string; // name
  i: Array<{
    // items
    n: string; // name
    q: number; // quantity
    p: number; // price
  }>;
}

interface CompactState {
  p: CompactPerson[]; // people
  d: {
    // discount
    t: "percentage" | "flat"; // type
    v: number; // value
    m: number; // minimumSpend
    x: number; // maxDiscountAmount
  };
  f: Array<{
    // fees
    n: string; // name
    a: number; // amount
  }>;
}

const compressState = (
  people: Person[],
  discountSettings: DiscountSettings,
  additionalFees: AdditionalFee[]
): string => {
  const compactState: CompactState = {
    p: people.map((person) => ({
      n: person.name,
      i: person.items.map((item) => ({
        n: item.name,
        q: item.quantity,
        p: item.price,
      })),
    })),
    d: {
      t: discountSettings.type,
      v: discountSettings.value,
      m: discountSettings.minimumSpend,
      x:
        discountSettings.maxDiscountAmount === Infinity
          ? -1
          : discountSettings.maxDiscountAmount,
    },
    f: additionalFees.map((fee) => ({
      n: fee.name,
      a: fee.amount,
    })),
  };

  return btoa(JSON.stringify(compactState));
};

const expandState = (
  compressed: string
): {
  people: Person[];
  discountSettings: DiscountSettings;
  additionalFees: AdditionalFee[];
} => {
  try {
    const compactState: CompactState = JSON.parse(atob(compressed));

    return {
      people: compactState.p.map((p) => ({
        id: crypto.randomUUID(),
        name: p.n,
        items: p.i.map((i) => ({
          id: crypto.randomUUID(),
          name: i.n,
          quantity: i.q,
          price: i.p,
        })),
      })),
      discountSettings: {
        type: compactState.d.t,
        value: compactState.d.v,
        minimumSpend: compactState.d.m,
        maxDiscountAmount:
          compactState.d.x === -1 ? Infinity : compactState.d.x,
      },
      additionalFees: compactState.f.map((f) => ({
        id: crypto.randomUUID(),
        name: f.n,
        amount: f.a,
      })),
    };
  } catch (error) {
    console.error("Error parsing state from URL:", error);
    return {
      people: [],
      discountSettings: {
        type: "percentage",
        value: 0,
        minimumSpend: 0,
        maxDiscountAmount: Infinity,
      },
      additionalFees: [],
    };
  }
};

interface BillSplitterProps {
  initialState?: string | null;
}

const BillSplitter = ({ initialState }: BillSplitterProps) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [discountSettings, setDiscountSettings] = useState<DiscountSettings>({
    type: "percentage",
    value: 0,
    minimumSpend: 0,
    maxDiscountAmount: Infinity,
  });
  const [additionalFees, setAdditionalFees] = useState<AdditionalFee[]>([]);
  const peopleContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // Load initial state from props
  useEffect(() => {
    if (initialState) {
      try {
        const {
          people: p,
          discountSettings: d,
          additionalFees: f,
        } = expandState(initialState);
        setPeople(p);
        setDiscountSettings(d);
        setAdditionalFees(f);
      } catch (error) {
        console.error("Error loading initial state:", error);
      }
    }
  }, [initialState]);

  // Update URL when state changes
  useEffect(() => {
    // Skip the first render to avoid overwriting the initial URL
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const state = compressState(people, discountSettings, additionalFees);
    const url = new URL(window.location.href);

    if (
      state ===
      compressState(
        [],
        {
          type: "percentage",
          value: 0,
          minimumSpend: 0,
          maxDiscountAmount: Infinity,
        },
        []
      )
    ) {
      if (url.searchParams.has("state")) {
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.toString());
      }
    } else {
      const currentState = url.searchParams.get("state");
      if (currentState !== state) {
        url.searchParams.set("state", state);
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [people, discountSettings, additionalFees]);

  const addPerson = () => {
    const newPerson: Person = {
      id: crypto.randomUUID(),
      name: "",
      items: [],
    };
    setPeople([...people, newPerson]);
  };

  const updatePerson = (personId: string, name: string) => {
    setPeople(
      people.map((person) =>
        person.id === personId ? { ...person, name } : person
      )
    );
  };

  const addItem = (personId: string) => {
    const newItem: Item = {
      id: crypto.randomUUID(),
      name: "",
      quantity: 1,
      price: 0,
    };
    setPeople(
      people.map((person) =>
        person.id === personId
          ? { ...person, items: [...person.items, newItem] }
          : person
      )
    );
  };

  const updateItem = (
    personId: string,
    itemId: string,
    updates: Partial<Item>
  ) => {
    setPeople(
      people.map((person) =>
        person.id === personId
          ? {
              ...person,
              items: person.items.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item
              ),
            }
          : person
      )
    );
  };

  const removeItem = (personId: string, itemId: string) => {
    setPeople(
      people.map((person) =>
        person.id === personId
          ? {
              ...person,
              items: person.items.filter((item) => item.id !== itemId),
            }
          : person
      )
    );
  };

  const removePerson = (personId: string) => {
    setPeople(people.filter((person) => person.id !== personId));
  };

  const addAdditionalFee = () => {
    const newFee: AdditionalFee = {
      id: crypto.randomUUID(),
      name: "",
      amount: 0,
    };
    setAdditionalFees([...additionalFees, newFee]);
  };

  const updateAdditionalFee = (
    feeId: string,
    updates: Partial<AdditionalFee>
  ) => {
    setAdditionalFees(
      additionalFees.map((fee) =>
        fee.id === feeId ? { ...fee, ...updates } : fee
      )
    );
  };

  const removeAdditionalFee = (feeId: string) => {
    setAdditionalFees(additionalFees.filter((fee) => fee.id !== feeId));
  };

  const calculateBillSummary = (): BillSummary[] => {
    const totalAdditionalFees = additionalFees.reduce(
      (sum, fee) => sum + fee.amount,
      0
    );
    const sharedFeesPerPerson = totalAdditionalFees / (people.length || 1);

    // Calculate total discount amount
    const totalDiscount =
      discountSettings.type === "percentage"
        ? Math.min(
            people.reduce(
              (sum, person) =>
                sum +
                person.items.reduce(
                  (itemSum, item) => itemSum + item.price * item.quantity,
                  0
                ),
              0
            ) *
              (discountSettings.value / 100),
            discountSettings.maxDiscountAmount
          )
        : Math.min(discountSettings.value, discountSettings.maxDiscountAmount);

    // Get distributed discount amounts
    const discountedAmounts = calculateDiscountedAmounts(
      people,
      totalDiscount,
      discountSettings.minimumSpend
    );

    return people.map((person) => {
      const subtotal = person.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const appliedDiscount = discountedAmounts[person.id] || 0;
      const discountedSubtotal = Math.max(0, subtotal - appliedDiscount);

      return {
        personId: person.id,
        subtotal,
        discountedSubtotal,
        sharedFees: sharedFeesPerPerson,
        total: discountedSubtotal + sharedFeesPerPerson,
      };
    });
  };

  const handleNumberInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    callback: (value: number) => void
  ) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    callback(value === "" ? 0 : parseInt(value, 10));
  };

  const calculateGrandTotal = () => {
    const summary = calculateBillSummary();
    return {
      subtotal: summary.reduce((sum, s) => sum + s.subtotal, 0),
      totalDiscount: summary.reduce(
        (sum, s) => sum + (s.subtotal - s.discountedSubtotal),
        0
      ),
      totalAfterDiscount: summary.reduce(
        (sum, s) => sum + s.discountedSubtotal,
        0
      ),
      totalSharedFees: summary.reduce((sum, s) => sum + s.sharedFees, 0),
      grandTotal: summary.reduce((sum, s) => sum + s.total, 0),
    };
  };

  const exportToImage = async () => {
    const container = document.createElement("div");
    container.style.padding = "1.5rem";
    container.style.backgroundColor = "white";
    container.style.maxWidth = "800px";
    container.style.margin = "0 auto";
    container.style.fontFamily = "system-ui, -apple-system, sans-serif";

    // Add title with date
    const title = document.createElement("div");
    title.style.textAlign = "center";
    title.style.marginBottom = "1.5rem";
    title.innerHTML = `
      <div style="font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; color: #1f2937">
        Bill Split Summary
      </div>
      <div style="color: #6b7280; font-size: 0.875rem">
        ${new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
    `;
    container.appendChild(title);

    // Add settings section
    const settingsSection = document.createElement("div");
    settingsSection.style.marginBottom = "1rem";
    settingsSection.style.padding = "0.75rem";
    settingsSection.style.backgroundColor = "#f9fafb";
    settingsSection.style.borderRadius = "0.5rem";
    settingsSection.style.fontSize = "0.875rem";

    // Add discount settings
    const discountInfo = document.createElement("div");
    discountInfo.style.display = "flex";
    discountInfo.style.flexWrap = "wrap";
    discountInfo.style.gap = "1rem";
    discountInfo.innerHTML = `
      <div>
        <strong>Discount:</strong> ${
          discountSettings.type === "percentage"
            ? `${discountSettings.value}%`
            : formatIDR(discountSettings.value)
        }
      </div>
      ${
        discountSettings.minimumSpend > 0
          ? `<div>
              <strong>Minimum Spend:</strong> ${formatIDR(
                discountSettings.minimumSpend
              )}
            </div>`
          : ""
      }
      ${
        discountSettings.maxDiscountAmount < Infinity
          ? `<div>
              <strong>Max Discount:</strong> ${formatIDR(
                discountSettings.maxDiscountAmount
              )}
            </div>`
          : ""
      }
    `;
    settingsSection.appendChild(discountInfo);

    // Add additional fees
    if (additionalFees.length > 0) {
      const feesInfo = document.createElement("div");
      feesInfo.style.marginTop = "0.5rem";
      feesInfo.style.paddingTop = "0.5rem";
      feesInfo.style.borderTop = "1px solid #e5e7eb";
      feesInfo.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 0.25rem">Additional Fees:</div>
        <div style="display: flex; flex-wrap: wrap; gap: 1rem">
          ${additionalFees
            .map(
              (fee) =>
                `<div>
                  ${fee.name}: ${formatIDR(fee.amount)}
                </div>`
            )
            .join("")}
        </div>
      `;
      settingsSection.appendChild(feesInfo);
    }

    container.appendChild(settingsSection);

    // Add people section
    const peopleSection = document.createElement("div");
    peopleSection.style.display = "grid";
    peopleSection.style.gridTemplateColumns =
      "repeat(auto-fit, minmax(350px, 1fr))";
    peopleSection.style.gap = "0.75rem";
    peopleSection.style.marginBottom = "1rem";

    people.forEach((person) => {
      const summary = calculateBillSummary().find(
        (s) => s.personId === person.id
      );
      if (!summary) return;

      const personCard = document.createElement("div");
      personCard.style.padding = "0.75rem";
      personCard.style.backgroundColor = "#ffffff";
      personCard.style.borderRadius = "0.5rem";
      personCard.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      personCard.style.fontSize = "0.875rem";

      personCard.innerHTML = `
        <div style="font-weight: bold; font-size: 1rem; margin-bottom: 0.75rem">
          ${person.name || "Unnamed Person"}
        </div>
        <div style="margin-bottom: 0.75rem">
          ${person.items
            .map(
              (item) => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem">
                  <span>${item.name} × ${item.quantity}</span>
                  <span>${formatIDR(item.price * item.quantity)}</span>
                </div>
              `
            )
            .join("")}
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 0.5rem">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem">
            <span>Subtotal:</span>
            <span>${formatIDR(summary.subtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; color: #2563eb; font-size: 0.75rem">
            <span>Discount:</span>
            <span>- ${formatIDR(
              summary.subtotal - summary.discountedSubtotal
            )}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem">
            <span>After Discount:</span>
            <span>${formatIDR(summary.discountedSubtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.75rem">
            <span>Shared Fees:</span>
            <span>+ ${formatIDR(summary.sharedFees)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; font-weight: bold">
            <span>Total:</span>
            <span>${formatIDR(summary.total)}</span>
          </div>
        </div>
      `;

      peopleSection.appendChild(personCard);
    });

    container.appendChild(peopleSection);

    // Add grand total section
    const grandTotal = calculateGrandTotal();
    const grandTotalSection = document.createElement("div");
    grandTotalSection.style.padding = "0.75rem";
    grandTotalSection.style.backgroundColor = "#f9fafb";
    grandTotalSection.style.borderRadius = "0.5rem";
    grandTotalSection.style.fontSize = "0.875rem";

    grandTotalSection.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem">
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem">
            <span>Total Subtotal:</span>
            <span>${formatIDR(grandTotal.subtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; color: #2563eb">
            <span>Total Discount:</span>
            <span>- ${formatIDR(grandTotal.totalDiscount)}</span>
          </div>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem">
            <span>Total After Discount:</span>
            <span>${formatIDR(grandTotal.totalAfterDiscount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem">
            <span>Total Shared Fees:</span>
            <span>+ ${formatIDR(grandTotal.totalSharedFees)}</span>
          </div>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; margin-top: 0.5rem; border-top: 1px solid #e5e7eb; font-weight: bold; font-size: 1rem">
        <span>Grand Total:</span>
        <span>${formatIDR(grandTotal.grandTotal)}</span>
      </div>
    `;

    container.appendChild(grandTotalSection);

    // Create the image
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight,
      });

      const link = document.createElement("a");
      link.download = `bill-split-${
        new Date().toISOString().split("T")[0]
      }.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error exporting to image:", error);
    } finally {
      document.body.removeChild(container);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
            <h2 className="text-xl font-bold">Discount Settings</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Type
                </label>
                <select
                  value={discountSettings.type}
                  onChange={(e) =>
                    setDiscountSettings({
                      ...discountSettings,
                      type: e.target.value as "percentage" | "flat",
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount (IDR)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {discountSettings.type === "percentage"
                    ? "Discount Percentage"
                    : "Discount Amount"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatNumber(discountSettings.value)}
                    onChange={(e) =>
                      handleNumberInput(e, (value) =>
                        setDiscountSettings({
                          ...discountSettings,
                          value,
                        })
                      )
                    }
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {discountSettings.type === "percentage" ? "%" : "Rp"}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Spend
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatNumber(discountSettings.minimumSpend)}
                    onChange={(e) =>
                      handleNumberInput(e, (value) =>
                        setDiscountSettings({
                          ...discountSettings,
                          minimumSpend: value,
                        })
                      )
                    }
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    Rp
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Discount
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatNumber(discountSettings.maxDiscountAmount)}
                    onChange={(e) =>
                      handleNumberInput(e, (value) =>
                        setDiscountSettings({
                          ...discountSettings,
                          maxDiscountAmount: value,
                        })
                      )
                    }
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    Rp
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Additional Fees</h2>
              <button
                onClick={addAdditionalFee}
                className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
              >
                Add Fee
              </button>
            </div>
            <div className="space-y-2">
              {additionalFees.map((fee) => (
                <div key={fee.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={fee.name}
                    onChange={(e) =>
                      updateAdditionalFee(fee.id, { name: e.target.value })
                    }
                    placeholder="Fee name"
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <div className="relative w-32">
                    <input
                      type="text"
                      value={formatNumber(fee.amount)}
                      onChange={(e) =>
                        handleNumberInput(e, (value) =>
                          updateAdditionalFee(fee.id, { amount: value })
                        )
                      }
                      placeholder="Amount"
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pl-8"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      Rp
                    </span>
                  </div>
                  <button
                    onClick={() => removeAdditionalFee(fee.id)}
                    className="p-1.5 text-red-500 hover:text-red-600"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Grand Total Card */}
          <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
            <h2 className="text-xl font-bold">Grand Total</h2>
            {people.length > 0 && (
              <div className="space-y-2">
                {(() => {
                  const grandTotal = calculateGrandTotal();
                  return (
                    <>
                      <div className="flex justify-between">
                        <span>Total Subtotal:</span>
                        <span>{formatIDR(grandTotal.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-blue-600 text-sm">
                        <span>Total Discount:</span>
                        <span>- {formatIDR(grandTotal.totalDiscount)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span>Total After Discount:</span>
                        <span>{formatIDR(grandTotal.totalAfterDiscount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Shared Fees:</span>
                        <span>+ {formatIDR(grandTotal.totalSharedFees)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg border-t pt-2">
                        <span>Grand Total:</span>
                        <span>{formatIDR(grandTotal.grandTotal)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* People and Items Panel */}
        <div className="lg:col-span-2 flex flex-col h-[calc(100vh-2rem)]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">People</h2>
              <button
                onClick={exportToImage}
                className="p-1.5 text-blue-500 hover:text-blue-600 flex items-center gap-2"
                title="Export all to image"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-sm">Export All</span>
              </button>
            </div>
            <button
              onClick={addPerson}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Add Person
            </button>
          </div>

          <div
            ref={peopleContainerRef}
            className="flex-1 overflow-y-auto space-y-6 pr-2"
          >
            {people.map((person) => {
              const summary = calculateBillSummary().find(
                (s) => s.personId === person.id
              );

              return (
                <div
                  key={person.id}
                  className="bg-white rounded-lg shadow-md p-4 space-y-4"
                >
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 space-y-4">
                      <div className="flex gap-4 items-center">
                        <input
                          type="text"
                          value={person.name}
                          onChange={(e) =>
                            updatePerson(person.id, e.target.value)
                          }
                          placeholder="Person name"
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => removePerson(person.id)}
                          className="p-1.5 text-red-500 hover:text-red-600"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-semibold">Items</h3>
                          <button
                            onClick={() => addItem(person.id)}
                            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                          >
                            Add Item
                          </button>
                        </div>
                        <div className="space-y-2">
                          {person.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex gap-2 items-center"
                            >
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  updateItem(person.id, item.id, {
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Item name"
                                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                              />
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">×</span>
                                <input
                                  type="text"
                                  value={formatNumber(item.quantity)}
                                  onChange={(e) =>
                                    handleNumberInput(e, (value) =>
                                      updateItem(person.id, item.id, {
                                        quantity: value,
                                      })
                                    )
                                  }
                                  placeholder="Qty"
                                  className="w-16 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                              <div className="relative w-32">
                                <input
                                  type="text"
                                  value={formatNumber(item.price)}
                                  onChange={(e) =>
                                    handleNumberInput(e, (value) =>
                                      updateItem(person.id, item.id, {
                                        price: value,
                                      })
                                    )
                                  }
                                  placeholder="Price"
                                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pl-8"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                  Rp
                                </span>
                              </div>
                              <button
                                onClick={() => removeItem(person.id, item.id)}
                                className="p-1.5 text-red-500 hover:text-red-600"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {summary && (
                      <div className="w-64 bg-gray-50 rounded-lg p-3 space-y-3 text-sm">
                        <div>
                          <div className="flex justify-between font-medium">
                            <span>Subtotal:</span>
                            <span>{formatIDR(summary.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-blue-600 text-xs mt-1">
                            <span>Discount:</span>
                            <span>
                              -{" "}
                              {formatIDR(
                                summary.subtotal - summary.discountedSubtotal
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex justify-between">
                            <span>After Discount:</span>
                            <span>{formatIDR(summary.discountedSubtotal)}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span>Shared Fees:</span>
                            <span>+ {formatIDR(summary.sharedFees)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-2 text-base">
                          <span>Total:</span>
                          <span>{formatIDR(summary.total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillSplitter;
