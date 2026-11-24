import { H as rollDice, i as diceOptions, n as usePlayViewPreferences, r as DiceSettings, s as useDiceController } from "./playViewPreferences-pt-MdMDq.js";
import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region app/dice-lab/page.tsx
var choices = [
	{
		name: "Четырёхгранник",
		formula: "1d4"
	},
	{
		name: "Все грани",
		formula: "1d4+1d6+1d8+1d10+1d12+1d20"
	},
	{
		name: "Проверка d20",
		formula: "1d20"
	},
	{
		name: "Три шестигранника",
		formula: "3d6"
	},
	{
		name: "Смешанный бросок",
		formula: "2d8+1d4+3"
	},
	{
		name: "Кубики d10",
		formula: "5d10"
	},
	{
		name: "Процентный бросок",
		formula: "1d100"
	},
	{
		name: "Много кубиков",
		formula: "12d6"
	}
];
var styles = {
	page: {
		minHeight: "100dvh",
		background: "radial-gradient(ellipse at 45% 28%,#253443,#0c111a 70%)",
		color: "#fff1dc",
		padding: "clamp(16px,3.5vw,38px)",
		fontFamily: "system-ui,Arial,sans-serif"
	},
	frame: {
		maxWidth: 850,
		margin: "0 auto",
		position: "relative",
		zIndex: 1
	},
	card: {
		background: "rgba(16,25,34,.94)",
		border: "1px solid #8c785e",
		borderRadius: 14,
		padding: "clamp(16px,2.3vw,24px)",
		boxShadow: "0 16px 40px #0005"
	},
	controls: {
		display: "flex",
		flexWrap: "wrap",
		gap: 10
	},
	button: {
		minHeight: 44,
		padding: "10px 14px",
		border: "1px solid #b99a66",
		borderRadius: 7,
		background: "#252e3c",
		color: "#fff1dc",
		cursor: "pointer",
		fontWeight: 650
	},
	muted: {
		color: "#c8c4bd",
		fontSize: 13,
		lineHeight: 1.55
	},
	link: {
		color: "#f4c981",
		textDecoration: "underline"
	}
};
function DiceLabPage() {
	const [view, updateView] = usePlayViewPreferences();
	const controller = useDiceController(diceOptions(view));
	const [build, setBuild] = useState("Загрузка номера сборки…");
	const [history, setHistory] = useState([]);
	const [formula, setFormula] = useState("2d6+1d4+3");
	const [error, setError] = useState("");
	useEffect(() => {
		let cancelled = false;
		fetch("../DICE_PREVIEW_BUILD.txt", { cache: "no-store" }).then((r) => r.ok ? r.text() : Promise.reject(Error("Not deployed"))).then((t) => {
			if (!cancelled) setBuild(t.trim());
		}).catch(() => {
			if (!cancelled) setBuild("Локальная сборка");
		});
		return () => {
			cancelled = true;
		};
	}, []);
	async function launch(name, value) {
		try {
			const result = await controller.run(() => rollDice(value));
			setHistory((previous) => [{
				name,
				result
			}, ...previous].slice(0, 8));
			setError("");
		} catch (reason) {
			if (reason.name !== "AbortError") setError(reason instanceof Error ? reason.message : String(reason));
		}
	}
	return /* @__PURE__ */ jsxs("main", {
		style: styles.page,
		children: [/* @__PURE__ */ jsxs("div", {
			style: styles.frame,
			children: [
				/* @__PURE__ */ jsxs("header", {
					style: {
						display: "flex",
						gap: 14,
						justifyContent: "space-between",
						alignItems: "center",
						flexWrap: "wrap",
						marginBottom: 18
					},
					children: [/* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx("div", {
							style: {
								fontSize: 12,
								color: "#d3b77e",
								letterSpacing: ".15em"
							},
							children: "HEROLIST · ИЗОЛИРОВАННЫЙ ТЕСТ"
						}),
						/* @__PURE__ */ jsx("h1", {
							style: {
								margin: "8px 0 4px",
								fontSize: "clamp(26px,4vw,36px)"
							},
							children: "Лаборатория кубиков"
						}),
						/* @__PURE__ */ jsx("div", {
							style: styles.muted,
							children: "Проверка живой анимации без создания персонажа и входа в аккаунт"
						})
					] }), /* @__PURE__ */ jsx("a", {
						style: styles.link,
						href: "../",
						children: "Вернуться в HeroList"
					})]
				}),
				/* @__PURE__ */ jsxs("section", {
					style: styles.card,
					children: [
						/* @__PURE__ */ jsx("p", {
							"data-testid": "dice-build",
							style: {
								color: "#edce98",
								fontFamily: "ui-monospace,Consolas,monospace",
								fontSize: 12,
								overflowWrap: "anywhere"
							},
							children: build
						}),
						/* @__PURE__ */ jsxs("p", {
							style: styles.muted,
							children: [
								"В этой версии кубики должны появляться ",
								/* @__PURE__ */ jsx("strong", { children: "справа" }),
								", быть небольшими и отскакивать друг от друга и от границ видимой области."
							]
						}),
						/* @__PURE__ */ jsx("div", {
							style: styles.controls,
							children: choices.map((item) => /* @__PURE__ */ jsx("button", {
								style: styles.button,
								"data-testid": "throw-" + item.formula.replace(/\W/g, "-"),
								onClick: () => launch(item.name, item.formula),
								children: item.formula
							}, item.formula))
						}),
						/* @__PURE__ */ jsxs("form", {
							onSubmit: (e) => {
								e.preventDefault();
								launch("Своя формула", formula);
							},
							style: {
								display: "flex",
								flexWrap: "wrap",
								gap: 10,
								marginTop: 14
							},
							children: [
								/* @__PURE__ */ jsx("input", {
									style: {
										flex: "1 1 220px",
										minWidth: 0,
										border: "1px solid #927757",
										background: "#111a25",
										color: "white",
										padding: 12,
										borderRadius: 7
									},
									"aria-label": "Своя формула броска",
									value: formula,
									onChange: (e) => setFormula(e.target.value)
								}),
								/* @__PURE__ */ jsx("button", {
									style: styles.button,
									type: "submit",
									children: "Бросить формулу"
								}),
								/* @__PURE__ */ jsx(DiceSettings, {
									view,
									onChange: updateView
								})
							]
						}),
						error && /* @__PURE__ */ jsx("p", {
							role: "alert",
							style: { color: "#ffaaa0" },
							children: error
						}),
						/* @__PURE__ */ jsx("hr", { style: {
							border: 0,
							borderTop: "1px solid #574f49",
							margin: "22px 0"
						} }),
						/* @__PURE__ */ jsxs("div", {
							style: {
								display: "flex",
								gap: 16,
								alignItems: "center",
								marginTop: 18
							},
							children: [/* @__PURE__ */ jsx("button", {
								style: styles.button,
								onClick: () => {
									controller.clear();
									setHistory([]);
								},
								children: "Очистить кубики"
							}), /* @__PURE__ */ jsxs("span", {
								"data-testid": "active-rolls",
								style: styles.muted,
								children: ["Активных бросков: ", controller.pending]
							})]
						}),
						history.length > 0 && /* @__PURE__ */ jsx("div", {
							"aria-label": "История тестовых бросков",
							style: {
								marginTop: 17,
								display: "grid",
								gap: 5
							},
							children: history.map((v, i) => /* @__PURE__ */ jsxs("div", {
								"data-testid": "dice-history-result",
								"data-result": JSON.stringify(v.result),
								style: {
									fontSize: 13,
									color: "#e8d3b3"
								},
								children: [
									v.name,
									" — ",
									v.result.formula,
									" = ",
									v.result.total
								]
							}, i))
						})
					]
				}),
				/* @__PURE__ */ jsxs("p", {
					style: {
						...styles.muted,
						marginTop: 18
					},
					children: [
						"Тестовый маршрут: ",
						/* @__PURE__ */ jsx("code", { children: "/dice-preview/dice-lab/" }),
						". Он использует тот же компонент анимации, что игровой режим."
					]
				})
			]
		}), controller.overlay]
	});
}
//#endregion
export { DiceLabPage as default };
