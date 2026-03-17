// FinanzasMX - Complete Personal Finance App
// Single-file React app with all modules

import { useState, useEffect, useCallback } from "react";

// ============================================================
// CONSTANTS & INITIAL DATA
// ============================================================
const CATEGORIES = {
  basicos: { label: "Básicos", color: "#4ECDC4", icon: "🏠" },
  gastos: { label: "Gastos", color: "#FFE66D", icon: "💳" },
  ahorro: { label: "Ahorro", color: "#A8E6CF", icon: "🎯" },
};

const DEFAULT_SUBCATEGORIES = {
  basicos: ["Renta/Hipoteca", "Luz", "Agua", "Gas", "Internet", "Teléfono", "Despensa", "Transporte"],
  gastos: ["Restaurantes", "Ropa", "Entretenimiento", "Salud", "Educación", "Mascotas", "Varios"],
  ahorro: ["Fondo de emergencia", "Viajes", "Electrónica", "Inversión"],
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const initialState = {
  // Config
  income: 0,
  budgetPct: { basicos: 50, gastos: 30, ahorro: 20 },
  subcategories: DEFAULT_SUBCATEGORIES,
  
  // Tarjetas
  cards: [
    { id: "c1", name: "BBVA Débito", type: "bancaria", cutDay: 15, payDay: 5, color: "#1E90FF" },
    { id: "c2", name: "Liverpool", type: "departamental", cutDay: 20, payDay: 10, color: "#E63946" },
  ],
  
  // Transacciones
  expenses: [], // { id, date, desc, amount, category, subcategory, cardId, type: 'unique'|'msi', msiMonths, msiCurrent, parentId }
  cardPayments: [], // { id, cardId, amount, date, month, year }
  
  // Metas
  goals: [], // { id, name, targetAmount, deadline, color, accounts: [{id, name, balance}] }
  goalDeposits: [], // { id, goalId, accountId, amount, date, note }
  
  // Meses cerrados
  closedMonths: [], // { month, year, summary }
  
  // UI
  activeTab: "dashboard",
  activeMonth: new Date().getMonth(),
  activeYear: new Date().getFullYear(),
};

// ============================================================
// STORAGE
// ============================================================
function loadState() {
  try {
    const saved = localStorage.getItem("finanzasmx_v1");
    if (saved) return { ...initialState, ...JSON.parse(saved) };
  } catch {}
  return initialState;
}

function saveState(state) {
  try {
    localStorage.setItem("finanzasmx_v1", JSON.stringify(state));
  } catch {}
}

// ============================================================
// UTILITIES
// ============================================================
function genId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function formatMXN(amount) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount || 0);
}

function getMonthLabel(month, year) {
  return `${MONTHS[month]} ${year}`;
}

function addMonths(month, year, n) {
  let m = month + n;
  let y = year + Math.floor(m / 12);
  m = m % 12;
  return { month: m, year: y };
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [state, setState] = useState(loadState);
  const [modal, setModal] = useState(null); // { type, data }

  useEffect(() => { saveState(state); }, [state]);

  const update = useCallback((patch) => setState(s => ({ ...s, ...patch })), []);
  const updateDeep = useCallback((key, val) => setState(s => ({ ...s, [key]: val })), []);

  const now = new Date();
  const { activeTab, activeMonth, activeYear } = state;

  // ---- Derived: expenses for active month ----
  const monthExpenses = state.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === activeMonth && d.getFullYear() === activeYear;
  });

  const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const budget = state.income;
  const catBudgets = Object.fromEntries(
    Object.keys(CATEGORIES).map(k => [k, (budget * state.budgetPct[k]) / 100])
  );
  const catSpent = Object.fromEntries(
    Object.keys(CATEGORIES).map(k => [
      k,
      monthExpenses.filter(e => e.category === k).reduce((s, e) => s + e.amount, 0)
    ])
  );

  // ---- Derived: card summary for active month ----
  const cardSummary = state.cards.map(card => {
    const charges = state.expenses.filter(e => {
      const d = new Date(e.date);
      return e.cardId === card.id && d.getMonth() === activeMonth && d.getFullYear() === activeYear;
    });
    const totalCharged = charges.reduce((s, e) => s + e.amount, 0);
    const payments = state.cardPayments.filter(p => p.cardId === card.id && p.month === activeMonth && p.year === activeYear);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    return { ...card, totalCharged, totalPaid, paid: totalPaid >= totalCharged && totalCharged > 0 };
  });

  // ---- Actions ----
  function addExpense(data) {
    const newExpenses = [...state.expenses];
    if (data.type === "msi" && data.msiMonths > 1) {
      const parentId = genId();
      const monthly = data.amount / data.msiMonths;
      const baseDate = new Date(data.date);
      for (let i = 0; i < data.msiMonths; i++) {
        const { month, year } = addMonths(baseDate.getMonth(), baseDate.getFullYear(), i);
        const d = new Date(year, month, baseDate.getDate());
        newExpenses.push({
          id: i === 0 ? parentId : genId(),
          parentId: i === 0 ? null : parentId,
          date: d.toISOString().split("T")[0],
          desc: `${data.desc} (${i + 1}/${data.msiMonths})`,
          amount: Math.round(monthly * 100) / 100,
          category: data.category,
          subcategory: data.subcategory,
          cardId: data.cardId,
          type: "msi",
          msiMonths: data.msiMonths,
          msiCurrent: i + 1,
        });
      }
    } else {
      newExpenses.push({
        id: genId(),
        ...data,
        type: "unique",
      });
    }
    updateDeep("expenses", newExpenses);
  }

  function deleteExpense(id) {
    const exp = state.expenses.find(e => e.id === id);
    if (exp?.type === "msi") {
      const parentId = exp.parentId || exp.id;
      updateDeep("expenses", state.expenses.filter(e => e.id !== parentId && e.parentId !== parentId));
    } else {
      updateDeep("expenses", state.expenses.filter(e => e.id !== id));
    }
  }

  function addCardPayment(data) {
    updateDeep("cardPayments", [...state.cardPayments, { id: genId(), ...data, month: activeMonth, year: activeYear }]);
  }

  function addGoal(data) {
    updateDeep("goals", [...state.goals, { id: genId(), ...data, accounts: [] }]);
  }

  function addGoalAccount(goalId, accountData) {
    updateDeep("goals", state.goals.map(g =>
      g.id === goalId ? { ...g, accounts: [...(g.accounts || []), { id: genId(), ...accountData, balance: 0 }] } : g
    ));
  }

  function addGoalDeposit(data) {
    updateDeep("goalDeposits", [...state.goalDeposits, { id: genId(), ...data, date: new Date().toISOString().split("T")[0] }]);
    updateDeep("goals", state.goals.map(g =>
      g.id === data.goalId ? {
        ...g,
        accounts: g.accounts.map(a =>
          a.id === data.accountId ? { ...a, balance: (a.balance || 0) + data.amount } : a
        )
      } : g
    ));
  }

  function addCard(data) {
    updateDeep("cards", [...state.cards, { id: genId(), ...data }]);
  }

  function closeMonth() {
    const summary = {
      month: activeMonth,
      year: activeYear,
      income: state.income,
      totalSpent,
      catSpent: { ...catSpent },
      catBudgets: { ...catBudgets },
      cardSummary: cardSummary.map(c => ({ name: c.name, totalCharged: c.totalCharged, totalPaid: c.totalPaid })),
    };
    updateDeep("closedMonths", [...state.closedMonths, summary]);
    setModal(null);
  }

  const isClosed = state.closedMonths.some(m => m.month === activeMonth && m.year === activeYear);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>◈</span>
            <span style={styles.logoText}>Finanzas</span>
            <span style={styles.logoAccent}>MX</span>
          </div>
          <MonthSelector
            month={activeMonth} year={activeYear}
            onChange={(m, y) => update({ activeMonth: m, activeYear: y })}
            isClosed={isClosed}
          />
        </div>
      </header>

      {/* Nav */}
      <nav style={styles.nav}>
        {[
          { id: "dashboard", icon: "◈", label: "Inicio" },
          { id: "expenses", icon: "↓", label: "Gastos" },
          { id: "cards", icon: "▣", label: "Tarjetas" },
          { id: "goals", icon: "◎", label: "Metas" },
          { id: "reports", icon: "≋", label: "Reportes" },
          { id: "settings", icon: "◉", label: "Config" },
        ].map(tab => (
          <button key={tab.id} style={{ ...styles.navBtn, ...(activeTab === tab.id ? styles.navBtnActive : {}) }}
            onClick={() => update({ activeTab: tab.id })}>
            <span style={styles.navIcon}>{tab.icon}</span>
            <span style={styles.navLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={styles.main}>
        {activeTab === "dashboard" && (
          <Dashboard
            state={state} monthExpenses={monthExpenses} totalSpent={totalSpent}
            catBudgets={catBudgets} catSpent={catSpent} cardSummary={cardSummary}
            activeMonth={activeMonth} activeYear={activeYear} isClosed={isClosed}
            onClose={() => setModal({ type: "closeMonth" })}
            onNewExpense={() => setModal({ type: "addExpense" })}
          />
        )}
        {activeTab === "expenses" && (
          <Expenses
            expenses={monthExpenses} allExpenses={state.expenses}
            cards={state.cards} subcategories={state.subcategories}
            activeMonth={activeMonth} activeYear={activeYear}
            onAdd={() => setModal({ type: "addExpense" })}
            onDelete={deleteExpense}
          />
        )}
        {activeTab === "cards" && (
          <Cards
            cards={state.cards} cardSummary={cardSummary}
            expenses={state.expenses} cardPayments={state.cardPayments}
            activeMonth={activeMonth} activeYear={activeYear}
            onAddPayment={(cardId) => setModal({ type: "addCardPayment", data: { cardId } })}
            onAddCard={() => setModal({ type: "addCard" })}
          />
        )}
        {activeTab === "goals" && (
          <Goals
            goals={state.goals} deposits={state.goalDeposits}
            onAddGoal={() => setModal({ type: "addGoal" })}
            onAddAccount={(goalId) => setModal({ type: "addGoalAccount", data: { goalId } })}
            onDeposit={(goalId, accountId) => setModal({ type: "addDeposit", data: { goalId, accountId } })}
          />
        )}
        {activeTab === "reports" && (
          <Reports state={state} />
        )}
        {activeTab === "settings" && (
          <Settings state={state} update={update} updateDeep={updateDeep} onAddCard={() => setModal({ type: "addCard" })} />
        )}
      </main>

      {/* Modals */}
      {modal && (
        <Modal onClose={() => setModal(null)}>
          {modal.type === "addExpense" && (
            <AddExpenseForm
              cards={state.cards} subcategories={state.subcategories}
              onSave={(data) => { addExpense(data); setModal(null); }}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "addCardPayment" && (
            <AddCardPaymentForm
              card={state.cards.find(c => c.id === modal.data.cardId)}
              onSave={(data) => { addCardPayment(data); setModal(null); }}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "addCard" && (
            <AddCardForm
              onSave={(data) => { addCard(data); setModal(null); }}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "addGoal" && (
            <AddGoalForm
              onSave={(data) => { addGoal(data); setModal(null); }}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "addGoalAccount" && (
            <AddGoalAccountForm
              goalId={modal.data.goalId}
              onSave={(data) => { addGoalAccount(modal.data.goalId, data); setModal(null); }}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "addDeposit" && (
            <AddDepositForm
              goals={state.goals} goalId={modal.data.goalId} accountId={modal.data.accountId}
              onSave={(data) => { addGoalDeposit(data); setModal(null); }}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "closeMonth" && (
            <CloseMonthConfirm
              month={activeMonth} year={activeYear}
              totalSpent={totalSpent} income={state.income}
              onConfirm={closeMonth} onClose={() => setModal(null)}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// MONTH SELECTOR
// ============================================================
function MonthSelector({ month, year, onChange, isClosed }) {
  function prev() {
    if (month === 0) onChange(11, year - 1);
    else onChange(month - 1, year);
  }
  function next() {
    if (month === 11) onChange(0, year + 1);
    else onChange(month + 1, year);
  }
  return (
    <div style={styles.monthSel}>
      <button onClick={prev} style={styles.monthBtn}>‹</button>
      <span style={styles.monthLabel}>
        {MONTHS[month].slice(0,3)} {year}
        {isClosed && <span style={styles.closedBadge}>Cerrado</span>}
      </span>
      <button onClick={next} style={styles.monthBtn}>›</button>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ state, monthExpenses, totalSpent, catBudgets, catSpent, cardSummary, activeMonth, activeYear, isClosed, onClose, onNewExpense }) {
  const { income } = state;
  const remaining = income - totalSpent;
  const pct = income > 0 ? Math.min((totalSpent / income) * 100, 100) : 0;

  return (
    <div style={styles.page}>
      {/* Balance Card */}
      <div style={styles.balanceCard}>
        <div style={styles.balanceTop}>
          <div>
            <div style={styles.balanceLabel}>Ingreso mensual</div>
            <div style={styles.balanceAmount}>{formatMXN(income)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={styles.balanceLabel}>Disponible</div>
            <div style={{ ...styles.balanceAmount, color: remaining >= 0 ? "#4ECDC4" : "#FF6B6B" }}>
              {formatMXN(remaining)}
            </div>
          </div>
        </div>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${pct}%`, background: pct > 90 ? "#FF6B6B" : pct > 70 ? "#FFE66D" : "#4ECDC4" }} />
        </div>
        <div style={styles.balanceFooter}>
          <span style={styles.balanceLabel}>Gastado: {formatMXN(totalSpent)}</span>
          <span style={styles.balanceLabel}>{pct.toFixed(0)}% del presupuesto</span>
        </div>
      </div>

      {/* Category Budgets */}
      <div style={styles.sectionTitle}>Presupuesto por Categoría</div>
      <div style={styles.catGrid}>
        {Object.entries(CATEGORIES).map(([key, cat]) => {
          const budget = catBudgets[key] || 0;
          const spent = catSpent[key] || 0;
          const p = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
          return (
            <div key={key} style={{ ...styles.catCard, borderTop: `3px solid ${cat.color}` }}>
              <div style={styles.catHeader}>
                <span>{cat.icon} {cat.label}</span>
                <span style={{ fontSize: "11px", color: "#888" }}>{state.budgetPct[key]}%</span>
              </div>
              <div style={styles.catAmounts}>
                <span style={{ color: cat.color, fontWeight: 700 }}>{formatMXN(spent)}</span>
                <span style={{ color: "#555", fontSize: "12px" }}>/ {formatMXN(budget)}</span>
              </div>
              <div style={{ ...styles.progressBar, marginTop: 8 }}>
                <div style={{ ...styles.progressFill, width: `${p}%`, background: cat.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Cards Quick View */}
      <div style={styles.sectionTitle}>Tarjetas este mes</div>
      <div style={styles.cardList}>
        {cardSummary.map(card => (
          <div key={card.id} style={{ ...styles.cardChip, borderLeft: `4px solid ${card.color}` }}>
            <div style={styles.cardChipName}>{card.name}</div>
            <div style={styles.cardChipAmounts}>
              <span style={{ color: "#ccc" }}>{formatMXN(card.totalCharged)}</span>
              {card.totalCharged > 0 && (
                <span style={{ ...styles.paidBadge, background: card.paid ? "#4ECDC4" : "#FF6B6B" }}>
                  {card.paid ? "✓ Pagada" : "Pendiente"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button style={styles.btnPrimary} onClick={onNewExpense}>+ Nuevo Gasto</button>
        {!isClosed && <button style={styles.btnSecondary} onClick={onClose}>Cerrar Mes</button>}
      </div>
    </div>
  );
}

// ============================================================
// EXPENSES
// ============================================================
function Expenses({ expenses, allExpenses, cards, subcategories, activeMonth, activeYear, onAdd, onDelete }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? expenses : expenses.filter(e => e.category === filter);

  // Also show future MSI payments
  const futurePayments = allExpenses.filter(e => {
    const d = new Date(e.date);
    const isThisMonth = d.getMonth() === activeMonth && d.getFullYear() === activeYear;
    return !isThisMonth && e.type === "msi";
  });

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div style={styles.sectionTitle}>Gastos del Mes</div>
        <button style={styles.btnPrimary} onClick={onAdd}>+ Agregar</button>
      </div>

      {/* Filter */}
      <div style={styles.filterRow}>
        {[{ id: "all", label: "Todos" }, ...Object.entries(CATEGORIES).map(([k, v]) => ({ id: k, label: v.label }))].map(f => (
          <button key={f.id} style={{ ...styles.filterBtn, ...(filter === f.id ? styles.filterBtnActive : {}) }}
            onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={styles.empty}>No hay gastos registrados</div>
      ) : (
        <div style={styles.expenseList}>
          {filtered.map(e => {
            const card = cards.find(c => c.id === e.cardId);
            const cat = CATEGORIES[e.category];
            return (
              <div key={e.id} style={styles.expenseItem}>
                <div style={{ ...styles.expenseDot, background: cat?.color || "#555" }} />
                <div style={styles.expenseInfo}>
                  <div style={styles.expenseDesc}>{e.desc}</div>
                  <div style={styles.expenseMeta}>
                    {cat?.label} {e.subcategory && `› ${e.subcategory}`}
                    {card && ` · ${card.name}`}
                    {e.type === "msi" && ` · MSI ${e.msiCurrent}/${e.msiMonths}`}
                  </div>
                  <div style={styles.expenseDate}>{e.date}</div>
                </div>
                <div style={styles.expenseRight}>
                  <div style={styles.expenseAmount}>{formatMXN(e.amount)}</div>
                  <button style={styles.deleteBtn} onClick={() => onDelete(e.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {futurePayments.length > 0 && (
        <>
          <div style={{ ...styles.sectionTitle, marginTop: 24 }}>Pagos MSI en meses futuros</div>
          <div style={styles.expenseList}>
            {futurePayments.slice(0, 10).map(e => (
              <div key={e.id} style={{ ...styles.expenseItem, opacity: 0.6 }}>
                <div style={{ ...styles.expenseDot, background: "#888" }} />
                <div style={styles.expenseInfo}>
                  <div style={styles.expenseDesc}>{e.desc}</div>
                  <div style={styles.expenseDate}>{e.date}</div>
                </div>
                <div style={styles.expenseAmount}>{formatMXN(e.amount)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// CARDS
// ============================================================
function Cards({ cards, cardSummary, expenses, cardPayments, activeMonth, activeYear, onAddPayment, onAddCard }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div style={styles.sectionTitle}>Tarjetas de Crédito</div>
        <button style={styles.btnPrimary} onClick={onAddCard}>+ Tarjeta</button>
      </div>

      <div style={styles.cardGrid}>
        {cardSummary.map(card => (
          <div key={card.id} style={{ ...styles.creditCard, background: `linear-gradient(135deg, ${card.color}99, ${card.color}44)`, borderColor: card.color }}>
            <div style={styles.creditCardName}>{card.name}</div>
            <div style={styles.creditCardType}>{card.type}</div>
            <div style={styles.creditCardRow}>
              <div>
                <div style={styles.creditCardLabel}>Corte: día {card.cutDay}</div>
                <div style={styles.creditCardLabel}>Pago: día {card.payDay}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={styles.creditCardAmount}>{formatMXN(card.totalCharged)}</div>
                <div style={{ ...styles.paidBadge, background: card.paid ? "#4ECDC4" : card.totalCharged > 0 ? "#FF6B6B" : "#444" }}>
                  {card.paid ? "✓ Pagada" : card.totalCharged > 0 ? "Pendiente" : "Sin cargos"}
                </div>
              </div>
            </div>
            <div style={styles.creditCardActions}>
              <button style={styles.btnSmall} onClick={() => setSelected(selected === card.id ? null : card.id)}>
                Ver detalle
              </button>
              <button style={styles.btnSmallPrimary} onClick={() => onAddPayment(card.id)}>
                Registrar pago
              </button>
            </div>

            {selected === card.id && (
              <div style={styles.cardDetail}>
                <div style={styles.cardDetailTitle}>Cargos del mes</div>
                {expenses.filter(e => {
                  const d = new Date(e.date);
                  return e.cardId === card.id && d.getMonth() === activeMonth && d.getFullYear() === activeYear;
                }).map(e => (
                  <div key={e.id} style={styles.cardDetailItem}>
                    <span>{e.desc}</span>
                    <span>{formatMXN(e.amount)}</span>
                  </div>
                ))}
                <div style={styles.cardDetailTitle}>Pagos registrados</div>
                {cardPayments.filter(p => p.cardId === card.id && p.month === activeMonth && p.year === activeYear).map(p => (
                  <div key={p.id} style={{ ...styles.cardDetailItem, color: "#4ECDC4" }}>
                    <span>{p.date} · {p.note || "Pago"}</span>
                    <span>{formatMXN(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Resumen */}
      <div style={styles.cardTotal}>
        <span>Total a pagar este mes:</span>
        <span style={{ color: "#FFE66D", fontWeight: 700 }}>
          {formatMXN(cardSummary.reduce((s, c) => s + c.totalCharged, 0))}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// GOALS
// ============================================================
function Goals({ goals, deposits, onAddGoal, onAddAccount, onDeposit }) {
  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div style={styles.sectionTitle}>Metas de Ahorro</div>
        <button style={styles.btnPrimary} onClick={onAddGoal}>+ Meta</button>
      </div>

      {goals.length === 0 ? (
        <div style={styles.empty}>No hay metas registradas. ¡Crea tu primera meta!</div>
      ) : (
        goals.map(goal => {
          const totalSaved = (goal.accounts || []).reduce((s, a) => s + (a.balance || 0), 0);
          const pct = goal.targetAmount > 0 ? Math.min((totalSaved / goal.targetAmount) * 100, 100) : 0;
          return (
            <div key={goal.id} style={{ ...styles.goalCard, borderTop: `3px solid ${goal.color || "#4ECDC4"}` }}>
              <div style={styles.goalHeader}>
                <div style={styles.goalName}>{goal.name}</div>
                {goal.deadline && <div style={styles.goalDeadline}>Meta: {goal.deadline}</div>}
              </div>
              <div style={styles.goalAmounts}>
                <span style={{ color: goal.color || "#4ECDC4", fontSize: 20, fontWeight: 700 }}>{formatMXN(totalSaved)}</span>
                <span style={{ color: "#666" }}> / {formatMXN(goal.targetAmount)}</span>
              </div>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${pct}%`, background: goal.color || "#4ECDC4" }} />
              </div>
              <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>{pct.toFixed(1)}% completado</div>

              {/* Accounts */}
              <div style={styles.goalAccounts}>
                {(goal.accounts || []).map(acc => (
                  <div key={acc.id} style={styles.goalAccount}>
                    <div>
                      <div style={styles.goalAccName}>{acc.name}</div>
                      <div style={styles.goalAccBalance}>{formatMXN(acc.balance || 0)}</div>
                    </div>
                    <button style={styles.btnSmallPrimary} onClick={() => onDeposit(goal.id, acc.id)}>Abonar</button>
                  </div>
                ))}
              </div>

              <button style={styles.btnSecondary} onClick={() => onAddAccount(goal.id)}>+ Cuenta</button>
            </div>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// REPORTS
// ============================================================
function Reports({ state }) {
  const [view, setView] = useState("current");
  const closedMonths = state.closedMonths;

  return (
    <div style={styles.page}>
      <div style={styles.sectionTitle}>Reportes</div>
      <div style={styles.filterRow}>
        <button style={{ ...styles.filterBtn, ...(view === "current" ? styles.filterBtnActive : {}) }} onClick={() => setView("current")}>Mes Actual</button>
        <button style={{ ...styles.filterBtn, ...(view === "history" ? styles.filterBtnActive : {}) }} onClick={() => setView("history")}>Historial</button>
      </div>

      {view === "current" && (
        <div>
          <div style={styles.reportCard}>
            <div style={styles.reportTitle}>Resumen de Presupuesto</div>
            {Object.entries(CATEGORIES).map(([key, cat]) => {
              const budget = (state.income * state.budgetPct[key]) / 100;
              const spent = state.expenses.filter(e => {
                const d = new Date(e.date);
                const now = new Date();
                return e.category === key && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).reduce((s, e) => s + e.amount, 0);
              const diff = budget - spent;
              return (
                <div key={key} style={styles.reportRow}>
                  <span>{cat.icon} {cat.label}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: cat.color }}>{formatMXN(spent)}</div>
                    <div style={{ fontSize: 11, color: diff >= 0 ? "#4ECDC4" : "#FF6B6B" }}>
                      {diff >= 0 ? `Disponible: ${formatMXN(diff)}` : `Excedido: ${formatMXN(Math.abs(diff))}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={styles.reportCard}>
            <div style={styles.reportTitle}>Metas de Ahorro</div>
            {state.goals.map(g => {
              const saved = (g.accounts || []).reduce((s, a) => s + (a.balance || 0), 0);
              const pct = g.targetAmount > 0 ? (saved / g.targetAmount * 100).toFixed(1) : 0;
              return (
                <div key={g.id} style={styles.reportRow}>
                  <span>{g.name}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: g.color || "#4ECDC4" }}>{formatMXN(saved)}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{pct}% de {formatMXN(g.targetAmount)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "history" && (
        <div>
          {closedMonths.length === 0 ? (
            <div style={styles.empty}>No hay meses cerrados aún</div>
          ) : (
            [...closedMonths].reverse().map((m, i) => (
              <div key={i} style={styles.reportCard}>
                <div style={styles.reportTitle}>{getMonthLabel(m.month, m.year)} <span style={styles.closedBadge}>Cerrado</span></div>
                <div style={styles.reportRow}>
                  <span>Ingreso</span><span style={{ color: "#4ECDC4" }}>{formatMXN(m.income)}</span>
                </div>
                <div style={styles.reportRow}>
                  <span>Gasto total</span><span style={{ color: "#FF6B6B" }}>{formatMXN(m.totalSpent)}</span>
                </div>
                <div style={styles.reportRow}>
                  <span>Balance</span>
                  <span style={{ color: m.income - m.totalSpent >= 0 ? "#4ECDC4" : "#FF6B6B" }}>
                    {formatMXN(m.income - m.totalSpent)}
                  </span>
                </div>
                {m.cardSummary && m.cardSummary.map((c, ci) => (
                  <div key={ci} style={{ ...styles.reportRow, fontSize: 12, opacity: 0.7 }}>
                    <span>▣ {c.name}</span><span>{formatMXN(c.totalCharged)}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function Settings({ state, update, updateDeep, onAddCard }) {
  const [income, setIncome] = useState(state.income);
  const [pct, setPct] = useState({ ...state.budgetPct });
  const [newSub, setNewSub] = useState({ cat: "basicos", name: "" });

  function saveBudget() {
    const total = Object.values(pct).reduce((s, v) => s + Number(v), 0);
    if (total !== 100) { alert("Los porcentajes deben sumar 100%"); return; }
    update({ income: Number(income), budgetPct: { basicos: Number(pct.basicos), gastos: Number(pct.gastos), ahorro: Number(pct.ahorro) } });
    alert("Configuración guardada");
  }

  function addSubcategory() {
    if (!newSub.name.trim()) return;
    const current = state.subcategories[newSub.cat] || [];
    if (current.includes(newSub.name.trim())) return;
    updateDeep("subcategories", { ...state.subcategories, [newSub.cat]: [...current, newSub.name.trim()] });
    setNewSub({ ...newSub, name: "" });
  }

  function removeSubcategory(cat, sub) {
    updateDeep("subcategories", {
      ...state.subcategories,
      [cat]: state.subcategories[cat].filter(s => s !== sub)
    });
  }

  const total = Object.values(pct).reduce((s, v) => s + Number(v), 0);

  return (
    <div style={styles.page}>
      <div style={styles.sectionTitle}>Configuración</div>

      {/* Income & Budget */}
      <div style={styles.settingsCard}>
        <div style={styles.settingsTitle}>Ingreso y Presupuesto</div>
        <label style={styles.label}>Ingreso mensual</label>
        <input style={styles.input} type="number" value={income} onChange={e => setIncome(e.target.value)} placeholder="0.00" />

        <div style={styles.settingsRow}>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <div key={key} style={styles.pctField}>
              <label style={{ ...styles.label, color: cat.color }}>{cat.icon} {cat.label}</label>
              <input style={styles.inputSmall} type="number" min="0" max="100"
                value={pct[key]} onChange={e => setPct({ ...pct, [key]: e.target.value })} />
              <span style={styles.pctSign}>%</span>
            </div>
          ))}
        </div>
        <div style={{ color: total === 100 ? "#4ECDC4" : "#FF6B6B", fontSize: 12, marginBottom: 8 }}>
          Total: {total}% {total !== 100 && "(debe ser 100%)"}
        </div>
        <button style={styles.btnPrimary} onClick={saveBudget}>Guardar</button>
      </div>

      {/* Subcategories */}
      <div style={styles.settingsCard}>
        <div style={styles.settingsTitle}>Subcategorías</div>
        <div style={styles.settingsRow}>
          <select style={styles.select} value={newSub.cat} onChange={e => setNewSub({ ...newSub, cat: e.target.value })}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input style={{ ...styles.input, flex: 1, marginBottom: 0 }} value={newSub.name}
            onChange={e => setNewSub({ ...newSub, name: e.target.value })}
            placeholder="Nueva subcategoría" />
          <button style={styles.btnPrimary} onClick={addSubcategory}>+</button>
        </div>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <div style={{ color: cat.color, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{cat.icon} {cat.label}</div>
            <div style={styles.tagList}>
              {(state.subcategories[key] || []).map(sub => (
                <div key={sub} style={styles.tag}>
                  {sub}
                  <button style={styles.tagDel} onClick={() => removeSubcategory(key, sub)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div style={styles.settingsCard}>
        <div style={styles.settingsTitle}>Tarjetas registradas</div>
        {state.cards.map(card => (
          <div key={card.id} style={styles.settingsCardItem}>
            <div style={{ ...styles.cardDot, background: card.color }} />
            <div>
              <div style={{ color: "#eee", fontWeight: 600 }}>{card.name}</div>
              <div style={{ color: "#888", fontSize: 12 }}>{card.type} · Corte día {card.cutDay} · Pago día {card.payDay}</div>
            </div>
          </div>
        ))}
        <button style={{ ...styles.btnSecondary, marginTop: 8 }} onClick={onAddCard}>+ Agregar tarjeta</button>
      </div>

      {/* Export */}
      <div style={styles.settingsCard}>
        <div style={styles.settingsTitle}>Respaldo de datos</div>
        <button style={styles.btnSecondary} onClick={() => {
          const blob = new Blob([localStorage.getItem("finanzasmx_v1")], { type: "application/json" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = `finanzasmx_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
        }}>⬇ Exportar JSON</button>
        <div style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
          Guarda este archivo en tu Google Drive o iCloud para respaldo
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL WRAPPER
// ============================================================
function Modal({ children, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modalBox}>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// FORMS
// ============================================================
function AddExpenseForm({ cards, subcategories, onSave, onClose }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    desc: "", amount: "", date: today,
    category: "gastos", subcategory: "",
    cardId: "", type: "unique", msiMonths: 3,
  });
  const f = (k, v) => setForm(s => ({ ...s, [k]: v }));

  function submit() {
    if (!form.desc || !form.amount || !form.date) return alert("Completa todos los campos requeridos");
    onSave({ ...form, amount: parseFloat(form.amount), msiMonths: parseInt(form.msiMonths) });
  }

  const subs = subcategories[form.category] || [];

  return (
    <div>
      <div style={styles.modalTitle}>Nuevo Gasto</div>
      <label style={styles.label}>Descripción *</label>
      <input style={styles.input} value={form.desc} onChange={e => f("desc", e.target.value)} placeholder="Ej: Súper Walmart" />
      <label style={styles.label}>Monto *</label>
      <input style={styles.input} type="number" value={form.amount} onChange={e => f("amount", e.target.value)} placeholder="0.00" />
      <label style={styles.label}>Fecha *</label>
      <input style={styles.input} type="date" value={form.date} onChange={e => f("date", e.target.value)} />
      <label style={styles.label}>Categoría</label>
      <select style={styles.select} value={form.category} onChange={e => f("category", e.target.value)}>
        {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
      </select>
      {subs.length > 0 && (
        <>
          <label style={styles.label}>Subcategoría</label>
          <select style={styles.select} value={form.subcategory} onChange={e => f("subcategory", e.target.value)}>
            <option value="">— Seleccionar —</option>
            {subs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </>
      )}
      <label style={styles.label}>Tarjeta</label>
      <select style={styles.select} value={form.cardId} onChange={e => f("cardId", e.target.value)}>
        <option value="">— Efectivo / Sin tarjeta —</option>
        {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label style={styles.label}>Tipo de pago</label>
      <div style={styles.radioRow}>
        {[{ v: "unique", l: "Pago único" }, { v: "msi", l: "MSI (meses sin intereses)" }].map(opt => (
          <label key={opt.v} style={styles.radioLabel}>
            <input type="radio" value={opt.v} checked={form.type === opt.v} onChange={() => f("type", opt.v)} />
            {opt.l}
          </label>
        ))}
      </div>
      {form.type === "msi" && (
        <>
          <label style={styles.label}>Número de meses</label>
          <select style={styles.select} value={form.msiMonths} onChange={e => f("msiMonths", e.target.value)}>
            {[3, 6, 9, 12, 18, 24].map(n => <option key={n} value={n}>{n} meses</option>)}
          </select>
          {form.amount && <div style={{ color: "#4ECDC4", fontSize: 13, marginBottom: 8 }}>
            Mensualidad: {formatMXN(parseFloat(form.amount || 0) / parseInt(form.msiMonths))}
          </div>}
        </>
      )}
      <div style={styles.modalActions}>
        <button style={styles.btnSecondary} onClick={onClose}>Cancelar</button>
        <button style={styles.btnPrimary} onClick={submit}>Guardar</button>
      </div>
    </div>
  );
}

function AddCardPaymentForm({ card, onSave, onClose }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ amount: "", date: today, note: "" });
  function submit() {
    if (!form.amount) return alert("Ingresa el monto");
    onSave({ cardId: card.id, amount: parseFloat(form.amount), date: form.date, note: form.note });
  }
  return (
    <div>
      <div style={styles.modalTitle}>Pago a {card?.name}</div>
      <label style={styles.label}>Monto pagado</label>
      <input style={styles.input} type="number" value={form.amount} onChange={e => setForm(s => ({ ...s, amount: e.target.value }))} placeholder="0.00" />
      <label style={styles.label}>Fecha</label>
      <input style={styles.input} type="date" value={form.date} onChange={e => setForm(s => ({ ...s, date: e.target.value }))} />
      <label style={styles.label}>Nota (opcional)</label>
      <input style={styles.input} value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} placeholder="Pago mínimo, total, etc." />
      <div style={styles.modalActions}>
        <button style={styles.btnSecondary} onClick={onClose}>Cancelar</button>
        <button style={styles.btnPrimary} onClick={submit}>Registrar pago</button>
      </div>
    </div>
  );
}

function AddCardForm({ onSave, onClose }) {
  const [form, setForm] = useState({ name: "", type: "bancaria", cutDay: 15, payDay: 5, color: "#4ECDC4" });
  const f = (k, v) => setForm(s => ({ ...s, [k]: v }));
  function submit() {
    if (!form.name) return alert("Ingresa el nombre");
    onSave(form);
  }
  return (
    <div>
      <div style={styles.modalTitle}>Nueva Tarjeta</div>
      <label style={styles.label}>Nombre</label>
      <input style={styles.input} value={form.name} onChange={e => f("name", e.target.value)} placeholder="Ej: BBVA Azul" />
      <label style={styles.label}>Tipo</label>
      <select style={styles.select} value={form.type} onChange={e => f("type", e.target.value)}>
        <option value="bancaria">Bancaria</option>
        <option value="departamental">Departamental</option>
      </select>
      <label style={styles.label}>Día de corte</label>
      <input style={styles.input} type="number" min="1" max="31" value={form.cutDay} onChange={e => f("cutDay", parseInt(e.target.value))} />
      <label style={styles.label}>Día límite de pago</label>
      <input style={styles.input} type="number" min="1" max="31" value={form.payDay} onChange={e => f("payDay", parseInt(e.target.value))} />
      <label style={styles.label}>Color</label>
      <input style={{ ...styles.input, padding: 4, height: 40 }} type="color" value={form.color} onChange={e => f("color", e.target.value)} />
      <div style={styles.modalActions}>
        <button style={styles.btnSecondary} onClick={onClose}>Cancelar</button>
        <button style={styles.btnPrimary} onClick={submit}>Agregar</button>
      </div>
    </div>
  );
}

function AddGoalForm({ onSave, onClose }) {
  const [form, setForm] = useState({ name: "", targetAmount: "", deadline: "", color: "#A8E6CF", notes: "" });
  const f = (k, v) => setForm(s => ({ ...s, [k]: v }));
  function submit() {
    if (!form.name || !form.targetAmount) return alert("Completa nombre y monto objetivo");
    onSave({ ...form, targetAmount: parseFloat(form.targetAmount) });
  }
  return (
    <div>
      <div style={styles.modalTitle}>Nueva Meta de Ahorro</div>
      <label style={styles.label}>Nombre de la meta</label>
      <input style={styles.input} value={form.name} onChange={e => f("name", e.target.value)} placeholder="Ej: Viaje a Europa" />
      <label style={styles.label}>Monto objetivo</label>
      <input style={styles.input} type="number" value={form.targetAmount} onChange={e => f("targetAmount", e.target.value)} placeholder="0.00" />
      <label style={styles.label}>Fecha límite (opcional)</label>
      <input style={styles.input} type="month" value={form.deadline} onChange={e => f("deadline", e.target.value)} />
      <label style={styles.label}>Color</label>
      <input style={{ ...styles.input, padding: 4, height: 40 }} type="color" value={form.color} onChange={e => f("color", e.target.value)} />
      <div style={styles.modalActions}>
        <button style={styles.btnSecondary} onClick={onClose}>Cancelar</button>
        <button style={styles.btnPrimary} onClick={submit}>Crear meta</button>
      </div>
    </div>
  );
}

function AddGoalAccountForm({ goalId, onSave, onClose }) {
  const [name, setName] = useState("");
  function submit() {
    if (!name.trim()) return alert("Ingresa el nombre de la cuenta");
    onSave({ name: name.trim() });
  }
  return (
    <div>
      <div style={styles.modalTitle}>Nueva Cuenta de Ahorro</div>
      <label style={styles.label}>Nombre de la cuenta</label>
      <input style={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: CETES, Fondeo, Efectivo" />
      <div style={styles.modalActions}>
        <button style={styles.btnSecondary} onClick={onClose}>Cancelar</button>
        <button style={styles.btnPrimary} onClick={submit}>Agregar</button>
      </div>
    </div>
  );
}

function AddDepositForm({ goals, goalId, accountId, onSave, onClose }) {
  const goal = goals.find(g => g.id === goalId);
  const account = (goal?.accounts || []).find(a => a.id === accountId);
  const [form, setForm] = useState({ amount: "", note: "" });
  function submit() {
    if (!form.amount) return alert("Ingresa el monto");
    onSave({ goalId, accountId, amount: parseFloat(form.amount), note: form.note });
  }
  return (
    <div>
      <div style={styles.modalTitle}>Abonar a {account?.name}</div>
      <div style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>Meta: {goal?.name}</div>
      <label style={styles.label}>Monto del abono</label>
      <input style={styles.input} type="number" value={form.amount} onChange={e => setForm(s => ({ ...s, amount: e.target.value }))} placeholder="0.00" />
      <label style={styles.label}>Nota (opcional)</label>
      <input style={styles.input} value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} placeholder="Quincena, bono, etc." />
      <div style={styles.modalActions}>
        <button style={styles.btnSecondary} onClick={onClose}>Cancelar</button>
        <button style={styles.btnPrimary} onClick={submit}>Abonar</button>
      </div>
    </div>
  );
}

function CloseMonthConfirm({ month, year, totalSpent, income, onConfirm, onClose }) {
  return (
    <div>
      <div style={styles.modalTitle}>Cerrar {getMonthLabel(month, year)}</div>
      <div style={{ color: "#aaa", marginBottom: 16, lineHeight: 1.6 }}>
        ¿Estás segura de cerrar este mes? Se guardará un resumen y ya no podrás modificarlo.
      </div>
      <div style={styles.reportRow}><span>Ingreso</span><span style={{ color: "#4ECDC4" }}>{formatMXN(income)}</span></div>
      <div style={styles.reportRow}><span>Gasto total</span><span style={{ color: "#FF6B6B" }}>{formatMXN(totalSpent)}</span></div>
      <div style={styles.reportRow}>
        <span>Balance</span>
        <span style={{ color: income - totalSpent >= 0 ? "#4ECDC4" : "#FF6B6B" }}>{formatMXN(income - totalSpent)}</span>
      </div>
      <div style={styles.modalActions}>
        <button style={styles.btnSecondary} onClick={onClose}>Cancelar</button>
        <button style={styles.btnPrimary} onClick={onConfirm}>Cerrar mes</button>
      </div>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = {
  app: { minHeight: "100vh", background: "#0e0e14", color: "#e8e8e8", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", paddingBottom: 80 },
  header: { background: "#16161f", borderBottom: "1px solid #2a2a3a", padding: "12px 16px", position: "sticky", top: 0, zIndex: 100 },
  headerInner: { display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 480, margin: "0 auto" },
  logo: { display: "flex", alignItems: "center", gap: 4 },
  logoIcon: { color: "#4ECDC4", fontSize: 20 },
  logoText: { fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" },
  logoAccent: { color: "#4ECDC4", fontWeight: 700, fontSize: 18 },
  monthSel: { display: "flex", alignItems: "center", gap: 8 },
  monthBtn: { background: "#2a2a3a", border: "none", color: "#fff", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 16 },
  monthLabel: { fontSize: 13, fontWeight: 600, color: "#ccc", display: "flex", alignItems: "center", gap: 6 },
  closedBadge: { background: "#2a2a3a", color: "#888", fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 600 },

  nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#16161f", borderTop: "1px solid #2a2a3a", display: "flex", justifyContent: "space-around", padding: "8px 0 12px", zIndex: 100 },
  navBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", color: "#555", cursor: "pointer", padding: "4px 8px", borderRadius: 8, transition: "color 0.2s" },
  navBtnActive: { color: "#4ECDC4" },
  navIcon: { fontSize: 18 },
  navLabel: { fontSize: 10, fontWeight: 600 },

  main: { maxWidth: 480, margin: "0 auto", padding: "0 0 16px" },
  page: { padding: "16px" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 },

  // Balance card
  balanceCard: { background: "#16161f", border: "1px solid #2a2a3a", borderRadius: 16, padding: 20, marginBottom: 20 },
  balanceTop: { display: "flex", justifyContent: "space-between", marginBottom: 16 },
  balanceLabel: { fontSize: 12, color: "#666", marginBottom: 4 },
  balanceAmount: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px" },
  balanceFooter: { display: "flex", justifyContent: "space-between", marginTop: 8 },
  progressBar: { height: 6, background: "#2a2a3a", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, transition: "width 0.4s ease" },

  // Category cards
  catGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 },
  catCard: { background: "#16161f", borderRadius: 12, padding: 12 },
  catHeader: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: "#aaa" },
  catAmounts: { display: "flex", flexDirection: "column", gap: 2 },

  // Card chips
  cardList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 },
  cardChip: { background: "#16161f", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardChipName: { fontSize: 14, fontWeight: 600 },
  cardChipAmounts: { display: "flex", alignItems: "center", gap: 8 },
  paidBadge: { fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 700, color: "#000" },

  actions: { display: "flex", gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1, background: "#4ECDC4", color: "#0e0e14", border: "none", borderRadius: 10, padding: "12px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  btnSecondary: { flex: 1, background: "#2a2a3a", color: "#ccc", border: "none", borderRadius: 10, padding: "12px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btnSmall: { background: "#2a2a3a", color: "#ccc", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" },
  btnSmallPrimary: { background: "#4ECDC4", color: "#0e0e14", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" },

  // Filter
  filterRow: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  filterBtn: { background: "#2a2a3a", border: "none", color: "#888", borderRadius: 20, padding: "6px 12px", fontSize: 12, cursor: "pointer" },
  filterBtnActive: { background: "#4ECDC4", color: "#0e0e14", fontWeight: 700 },

  // Expenses
  expenseList: { display: "flex", flexDirection: "column", gap: 8 },
  expenseItem: { background: "#16161f", borderRadius: 12, padding: 12, display: "flex", alignItems: "flex-start", gap: 10 },
  expenseDot: { width: 8, height: 8, borderRadius: "50%", marginTop: 6, flexShrink: 0 },
  expenseInfo: { flex: 1 },
  expenseDesc: { fontSize: 14, fontWeight: 600, marginBottom: 3 },
  expenseMeta: { fontSize: 11, color: "#666" },
  expenseDate: { fontSize: 11, color: "#555", marginTop: 2 },
  expenseRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 },
  expenseAmount: { fontSize: 15, fontWeight: 700, color: "#FFE66D" },
  deleteBtn: { background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12, padding: 0 },
  empty: { color: "#555", textAlign: "center", padding: "40px 0", fontSize: 14 },

  // Credit cards
  cardGrid: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 },
  creditCard: { borderRadius: 16, padding: 16, border: "1px solid" },
  creditCardName: { fontSize: 17, fontWeight: 700, marginBottom: 2 },
  creditCardType: { fontSize: 11, color: "#aaa", textTransform: "uppercase", marginBottom: 12 },
  creditCardRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 },
  creditCardLabel: { fontSize: 12, color: "#aaa" },
  creditCardAmount: { fontSize: 22, fontWeight: 700 },
  creditCardActions: { display: "flex", gap: 8 },
  cardDetail: { marginTop: 12, borderTop: "1px solid #ffffff22", paddingTop: 12 },
  cardDetailTitle: { fontSize: 11, color: "#888", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" },
  cardDetailItem: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#ccc", marginBottom: 4 },
  cardTotal: { background: "#16161f", borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 },

  // Goals
  goalCard: { background: "#16161f", borderRadius: 16, padding: 16, marginBottom: 12 },
  goalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  goalName: { fontSize: 16, fontWeight: 700 },
  goalDeadline: { fontSize: 11, color: "#888" },
  goalAmounts: { marginBottom: 8 },
  goalAccounts: { marginTop: 12, display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 },
  goalAccount: { background: "#1e1e2e", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  goalAccName: { fontSize: 13, fontWeight: 600 },
  goalAccBalance: { fontSize: 12, color: "#888", marginTop: 2 },

  // Reports
  reportCard: { background: "#16161f", borderRadius: 14, padding: 16, marginBottom: 12 },
  reportTitle: { fontSize: 14, fontWeight: 700, color: "#ccc", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 },
  reportRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #2a2a3a", fontSize: 13 },

  // Settings
  settingsCard: { background: "#16161f", borderRadius: 14, padding: 16, marginBottom: 12 },
  settingsTitle: { fontSize: 14, fontWeight: 700, color: "#4ECDC4", marginBottom: 14 },
  settingsRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 12 },
  settingsCardItem: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  cardDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  pctField: { display: "flex", alignItems: "center", gap: 4 },

  // Forms
  label: { display: "block", fontSize: 12, color: "#888", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { width: "100%", background: "#1e1e2e", border: "1px solid #2a2a3a", borderRadius: 10, padding: "10px 12px", color: "#eee", fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" },
  inputSmall: { width: 60, background: "#1e1e2e", border: "1px solid #2a2a3a", borderRadius: 8, padding: "8px 8px", color: "#eee", fontSize: 14, outline: "none" },
  select: { width: "100%", background: "#1e1e2e", border: "1px solid #2a2a3a", borderRadius: 10, padding: "10px 12px", color: "#eee", fontSize: 14, marginBottom: 14, outline: "none" },
  pctSign: { fontSize: 14, color: "#888" },
  radioRow: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  radioLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#ccc", cursor: "pointer" },

  // Modal
  modalOverlay: { position: "fixed", inset: 0, background: "#000000cc", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 },
  modalBox: { background: "#16161f", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto" },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#fff" },
  modalActions: { display: "flex", gap: 10, marginTop: 8 },

  // Tags
  tagList: { display: "flex", flexWrap: "wrap", gap: 6 },
  tag: { background: "#2a2a3a", borderRadius: 20, padding: "4px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "#ccc" },
  tagDel: { background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 10, padding: 0 },
};
