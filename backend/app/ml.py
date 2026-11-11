"""Local TF-IDF logistic models for type, topic, and action labels.

The committed examples are synthetic and non-sensitive. Held-out rows are frozen
and are not used to fit weights or to choose thresholds.
"""

from __future__ import annotations

import math
import re
from collections import Counter

import numpy as np

from app.catalog import DOCUMENT_TYPES, TOPICS

MODEL_ID = "local-tfidf-logistic-v1"
TOKEN = re.compile(r"[a-z0-9]+")

# Frozen before evaluation. Do not retune these against the held-out rows.
TYPE_STEPS = 240
TYPE_LR = 0.6
TYPE_L2 = 0.08
TOPIC_STEPS = 280
TOPIC_LR = 0.7
TOPIC_L2 = 0.2
ACTION_STEPS = 360
ACTION_LR = 1.1
ACTION_L2 = 0.015
PRIORITY_STEPS = 240


def words(text: str) -> list[str]:
    return [word for word in TOKEN.findall(text.lower()) if len(word) >= 3]


def tokenize(text: str) -> list[str]:
    tokens = words(text)
    tokens.extend(f"{left}_{right}" for left, right in zip(words(text), words(text)[1:]))
    return tokens


_TOPIC_WORDS = {
    "networks": ("packet", "routing", "tcp", "latency", "congestion"),
    "databases": ("sql", "query", "transaction", "index"),
    "algorithms": ("graph", "sorting", "complexity", "recurrence"),
    "calculus": ("derivative", "integral", "limit"),
    "accounting": ("ledger", "balance", "tax"),
    "scheduling": ("calendar", "agenda", "timeslot"),
}
_TYPE_FRAMES = {
    "lecture note": (
        "Lecture notes. The instructor covered {words}. A definition and theorem were copied in class.",
        "Classroom lecture reviewing {words}. Students wrote the theorem beside the definition.",
        "Today's lecture introduced {words} and restated the definition on the board.",
    ),
    "assignment": (
        "Homework assignment on {words}. Submit the answers. The rubric lists the points.",
        "Assignment sheet covering {words}. Complete the homework and submit it for rubric points.",
        "This assignment asks for worked answers about {words} and a completed submission.",
    ),
    "project report": (
        "Project report. The methodology examined {words}. Findings and the conclusion follow the experiment.",
        "Final project report on {words}, with methodology, findings, and a written conclusion.",
        "The experiment report describes {words}. Methodology and findings support the conclusion.",
    ),
    "bill": (
        "Invoice for {words}. The billed amount and payment total are printed on this bill.",
        "Payment receipt and invoice. Amount billed for {words}. The total is due on this bill.",
        "Bill requesting payment. The invoice amount covers {words}.",
    ),
    "other": (
        "Personal miscellaneous note mentioning {words} without a lecture, assignment, report, or invoice.",
        "Loose reminder about {words}. This is not homework, not a bill, and not class notes.",
        "Unsorted personal scribble that happens to mention {words}.",
    ),
}


def _train_documents() -> list[dict]:
    rows = []
    index = 0
    for label, frames in _TYPE_FRAMES.items():
        for topic, tokens in _TOPIC_WORDS.items():
            for frame in frames:
                rows.append(
                    {
                        "id": f"train-doc-{index}",
                        "split": "train",
                        "kind": "doc",
                        "label": label,
                        "topics": (topic,),
                        "text": frame.format(words=" ".join(tokens)),
                    }
                )
                index += 1
    return rows


TRAIN_DOCUMENTS = _train_documents()
HELD_DOCUMENTS = [
    {"id": "held-doc-lecture-networks", "split": "heldout", "kind": "doc", "label": "lecture note", "topics": ("networks",), "text": "In the morning lecture the class copied a theorem and a definition about packet routing and tcp latency. These are my classroom notes."},
    {"id": "held-doc-lecture-calculus", "split": "heldout", "kind": "doc", "label": "lecture note", "topics": ("calculus",), "text": "Lecture notebook: the instructor proved a theorem and restated the definition of a derivative, then sketched a limit on the board."},
    {"id": "held-doc-assignment-algorithms", "split": "heldout", "kind": "doc", "label": "assignment", "topics": ("algorithms",), "text": "This homework assignment asks for the sorting complexity of a graph traversal. Submit the answers. The rubric lists the points."},
    {"id": "held-doc-assignment-databases", "split": "heldout", "kind": "doc", "label": "assignment", "topics": ("databases",), "text": "Assignment instructions: finish the sql homework on transaction isolation and database indexes, then submit it for rubric points."},
    {"id": "held-doc-report-networks", "split": "heldout", "kind": "doc", "label": "project report", "topics": ("networks",), "text": "Project report. Methodology measured packet routing under congestion. The findings support the conclusion of the experiment."},
    {"id": "held-doc-report-calculus", "split": "heldout", "kind": "doc", "label": "project report", "topics": ("calculus",), "text": "Our project report explains the experiment, methodology, findings, and conclusion for a definite integral approximation."},
    {"id": "held-doc-bill-accounting", "split": "heldout", "kind": "doc", "label": "bill", "topics": ("accounting",), "text": "Invoice number 184. The billed amount and payment total cover ledger reconciliation. This bill requests payment."},
    {"id": "held-doc-bill-scheduling", "split": "heldout", "kind": "doc", "label": "bill", "topics": ("scheduling",), "text": "Bill for reserved timeslots. The invoice states the amount billed and the payment total for the calendar booking."},
    {"id": "held-doc-other-scheduling", "split": "heldout", "kind": "doc", "label": "other", "topics": ("scheduling",), "text": "A miscellaneous personal scribble about a calendar hold and a meeting agenda. Not a lecture, homework, report, or invoice."},
    {"id": "held-doc-other-databases", "split": "heldout", "kind": "doc", "label": "other", "topics": ("databases",), "text": "Loose personal reminder that mentions sql only in passing. It is not an assignment, bill, lecture, or project report."},
]

TRAIN_ACTIONS = [
    {"id": "train-act-1", "split": "train", "label": 1, "priority": "high", "due": "2026-11-20", "text": "Please submit the lab writeup by 2026-11-20."},
    {"id": "train-act-2", "split": "train", "label": 1, "priority": "high", "due": "2026-12-01", "text": "Action item: email the advisor the revised draft by 2026-12-01."},
    {"id": "train-act-3", "split": "train", "label": 1, "priority": "medium", "due": "2026-11-18", "text": "Remember to pay the invoice before 2026-11-18."},
    {"id": "train-act-4", "split": "train", "label": 1, "priority": "medium", "due": None, "text": "Please review the shared outline and send the comments."},
    {"id": "train-act-5", "split": "train", "label": 1, "priority": "low", "due": None, "text": "When you can, please file the receipt in the folder."},
    {"id": "train-act-6", "split": "train", "label": 1, "priority": "high", "due": "2026-10-30", "text": "Urgent: please finish the problem set by 2026-10-30."},
    {"id": "train-act-7", "split": "train", "label": 1, "priority": "medium", "due": None, "text": "Action item: send the meeting notes to the group."},
    {"id": "train-act-8", "split": "train", "label": 1, "priority": "low", "due": None, "text": "Please archive the old handout when convenient."},
    {"id": "train-act-9", "split": "train", "label": 1, "priority": "high", "due": "2026-09-15", "text": "Please email the registrar today and submit the form by 2026-09-15."},
    {"id": "train-act-10", "split": "train", "label": 1, "priority": "medium", "due": "2026-08-02", "text": "Remember to review the checklist before 2026-08-02."},
    {"id": "train-act-11", "split": "train", "label": 1, "priority": "low", "due": None, "text": "Action item: file the printed syllabus when you can."},
    {"id": "train-act-12", "split": "train", "label": 1, "priority": "medium", "due": None, "text": "Please send the bibliography to the project partner."},
    {"id": "train-neg-1", "split": "train", "label": 0, "priority": None, "due": None, "text": "The lecture covered packet routing and a theorem."},
    {"id": "train-neg-2", "split": "train", "label": 0, "priority": None, "due": None, "text": "This invoice was already paid on 2026-10-01."},
    {"id": "train-neg-3", "split": "train", "label": 0, "priority": None, "due": None, "text": "Students must submit work in general, according to the syllabus."},
    {"id": "train-neg-4", "split": "train", "label": 0, "priority": None, "due": None, "text": "We discussed whether deadlines should stay flexible."},
    {"id": "train-neg-5", "split": "train", "label": 0, "priority": None, "due": None, "text": "The database index improved the query time."},
    {"id": "train-neg-6", "split": "train", "label": 0, "priority": None, "due": None, "text": "A payment total was printed on the old bill."},
    {"id": "train-neg-7", "split": "train", "label": 0, "priority": None, "due": None, "text": "The experiment findings did not include a new task."},
    {"id": "train-neg-8", "split": "train", "label": 0, "priority": None, "due": None, "text": "Email addresses of the department are listed below."},
    {"id": "train-neg-9", "split": "train", "label": 0, "priority": None, "due": None, "text": "The rubric explains how points were assigned last term."},
    {"id": "train-neg-10", "split": "train", "label": 0, "priority": None, "due": None, "text": "Already paid invoices are filed with the ledger."},
    {"id": "train-neg-11", "split": "train", "label": 0, "priority": None, "due": None, "text": "Class notes define congestion control without asking for follow-up."},
    {"id": "train-neg-12", "split": "train", "label": 0, "priority": None, "due": None, "text": "The calendar shows a past meeting and no remaining obligation."},
]
HELD_ACTIONS = [
    {"id": "held-act-1", "split": "heldout", "label": 1, "priority": "high", "due": "2026-12-01", "text": "Please submit the lab report by 2026-12-01."},
    {"id": "held-act-2", "split": "heldout", "label": 1, "priority": "medium", "due": None, "text": "Action item: email the group the revised outline."},
    {"id": "held-act-3", "split": "heldout", "label": 1, "priority": "high", "due": "2026-11-30", "text": "Urgent: please pay the studio invoice before 2026-11-30."},
    {"id": "held-act-4", "split": "heldout", "label": 1, "priority": "low", "due": None, "text": "When you can, please file the signed form."},
    {"id": "held-act-5", "split": "heldout", "label": 1, "priority": "medium", "due": "2026-07-19", "text": "Remember to review the draft before 2026-07-19."},
    {"id": "held-act-6", "split": "heldout", "label": 1, "priority": "medium", "due": None, "text": "Please send the corrected bibliography to the partner."},
    {"id": "held-neg-1", "split": "heldout", "label": 0, "priority": None, "due": None, "text": "The lecture defined packet switching and routing tables."},
    {"id": "held-neg-2", "split": "heldout", "label": 0, "priority": None, "due": None, "text": "This invoice was already paid on 2026-10-02."},
    {"id": "held-neg-3", "split": "heldout", "label": 0, "priority": None, "due": None, "text": "We discussed whether deadlines should be flexible."},
    {"id": "held-neg-4", "split": "heldout", "label": 0, "priority": None, "due": None, "text": "Email was mentioned only as a historical communication method."},
    {"id": "held-neg-5", "split": "heldout", "label": 0, "priority": None, "due": None, "text": "The assignment description says students submit work during a normal term."},
    {"id": "held-neg-6", "split": "heldout", "label": 0, "priority": None, "due": None, "text": "A past payment total appeared on the archived bill."},
]


def _vocabulary(texts: list[str], tokenizer=tokenize) -> list[str]:
    counts: Counter[str] = Counter()
    for text in texts:
        counts.update(set(tokenizer(text)))
    chosen = [token for token, count in counts.items() if count >= 2]
    return sorted(chosen)


def _matrix(texts: list[str], vocabulary: list[str], idf: np.ndarray, tokenizer=tokenize) -> np.ndarray:
    index = {token: pos for pos, token in enumerate(vocabulary)}
    matrix = np.zeros((len(texts), len(vocabulary)), dtype=float)
    for row, text in enumerate(texts):
        seen = set(tokenizer(text))
        for token in seen:
            pos = index.get(token)
            if pos is not None:
                matrix[row, pos] = 1.0
    matrix *= idf
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return matrix / norms


def _idf(texts: list[str], vocabulary: list[str], tokenizer=tokenize) -> np.ndarray:
    index = {token: pos for pos, token in enumerate(vocabulary)}
    df = np.zeros(len(vocabulary), dtype=float)
    for text in texts:
        for token in set(tokenizer(text)):
            pos = index.get(token)
            if pos is not None:
                df[pos] += 1
    return np.log((len(texts) + 1) / (df + 1)) + 1


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - logits.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


def _fit_multinomial(features: np.ndarray, labels: list[str], classes: tuple[str, ...], steps: int, lr: float, l2: float):
    count, width = features.shape
    mapping = {label: pos for pos, label in enumerate(classes)}
    target = np.zeros((count, len(classes)))
    for row, label in enumerate(labels):
        target[row, mapping[label]] = 1
    weights = np.zeros((width, len(classes)))
    bias = np.zeros(len(classes))
    for _ in range(steps):
        probs = _softmax(features @ weights + bias)
        error = probs - target
        weights -= lr * ((features.T @ error) / count + l2 * weights)
        bias -= lr * error.mean(axis=0)
    return weights, bias


def _fit_binary(features: np.ndarray, labels: np.ndarray, steps: int, lr: float, l2: float):
    count = features.shape[0]
    weights = np.zeros(features.shape[1])
    bias = 0.0
    target = labels.astype(float)
    for _ in range(steps):
        probs = 1 / (1 + np.exp(-np.clip(features @ weights + bias, -30, 30)))
        error = probs - target
        weights -= lr * ((features.T @ error) / count + l2 * weights)
        bias -= lr * float(error.mean())
    return weights, bias


def _best_topic_threshold(probs: np.ndarray, gold: np.ndarray) -> float:
    best = 0.5
    best_f1 = -1.0
    for step in range(20, 80, 5):
        threshold = step / 100
        scores = _binary_scores(gold.ravel(), (probs >= threshold).ravel())
        if scores["f1"] > best_f1:
            best_f1 = scores["f1"]
            best = threshold
    return best


def _binary_scores(gold: np.ndarray, pred: np.ndarray) -> dict[str, float]:
    tp = int(np.sum((gold == 1) & (pred == 1)))
    fp = int(np.sum((gold == 0) & (pred == 1)))
    fn = int(np.sum((gold == 1) & (pred == 0)))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall, "f1": f1}


def _macro_f1(gold: list[str], pred: list[str], classes: tuple[str, ...]) -> float:
    scores = []
    for label in classes:
        gold_bin = np.array([1 if item == label else 0 for item in gold])
        pred_bin = np.array([1 if item == label else 0 for item in pred])
        scores.append(_binary_scores(gold_bin, pred_bin)["f1"])
    return float(sum(scores) / len(scores)) if scores else 0.0


class LocalModel:
    def __init__(self):
        docs = TRAIN_DOCUMENTS
        actions = list(TRAIN_ACTIONS)
        doc_texts = [row["text"] for row in docs]
        action_texts = [row["text"] for row in actions]
        self.doc_vocabulary = _vocabulary(doc_texts, words)
        self.doc_idf = _idf(doc_texts, self.doc_vocabulary, words)
        self.action_vocabulary = _vocabulary(action_texts, tokenize)
        self.action_idf = _idf(action_texts, self.action_vocabulary, tokenize)
        doc_x = _matrix(doc_texts, self.doc_vocabulary, self.doc_idf, words)
        self.type_weights, self.type_bias = _fit_multinomial(
            doc_x, [row["label"] for row in docs], DOCUMENT_TYPES, TYPE_STEPS, TYPE_LR, TYPE_L2
        )
        topic_gold = np.zeros((len(docs), len(TOPICS)))
        for row, item in enumerate(docs):
            for topic in item["topics"]:
                topic_gold[row, TOPICS.index(topic)] = 1
        self.topic_weights = np.zeros((doc_x.shape[1], len(TOPICS)))
        self.topic_bias = np.zeros(len(TOPICS))
        topic_probs = np.zeros_like(topic_gold)
        for pos, _topic in enumerate(TOPICS):
            weights, bias = _fit_binary(doc_x, topic_gold[:, pos], TOPIC_STEPS, TOPIC_LR, TOPIC_L2)
            self.topic_weights[:, pos] = weights
            self.topic_bias[pos] = bias
            topic_probs[:, pos] = 1 / (1 + np.exp(-np.clip(doc_x @ weights + bias, -30, 30)))
        self.topic_threshold = _best_topic_threshold(topic_probs, topic_gold)
        self.centroids = np.zeros((len(TOPICS), doc_x.shape[1]))
        for pos in range(len(TOPICS)):
            chosen = doc_x[topic_gold[:, pos] == 1]
            if len(chosen):
                center = chosen.mean(axis=0)
                norm = np.linalg.norm(center) or 1
                self.centroids[pos] = center / norm
        action_x = _matrix(action_texts, self.action_vocabulary, self.action_idf, tokenize)
        self.action_weights, self.action_bias = _fit_binary(
            action_x, np.array([row["label"] for row in actions]), ACTION_STEPS, ACTION_LR, ACTION_L2
        )
        positives = [row for row in actions if row["label"] == 1]
        self.priority_weights, self.priority_bias = _fit_multinomial(
            _matrix([row["text"] for row in positives], self.action_vocabulary, self.action_idf, tokenize),
            [row["priority"] for row in positives],
            ("low", "medium", "high"),
            PRIORITY_STEPS,
            0.8,
            0.02,
        )
        self.model_id = MODEL_ID

    def _doc_vector(self, text: str) -> np.ndarray:
        return _matrix([text], self.doc_vocabulary, self.doc_idf, words)[0]

    def _action_vector(self, text: str) -> np.ndarray:
        return _matrix([text], self.action_vocabulary, self.action_idf, tokenize)[0]

    def classify(self, text: str) -> dict:
        vector = self._doc_vector(text)
        type_probs = _softmax((vector @ self.type_weights + self.type_bias).reshape(1, -1))[0]
        type_index = int(type_probs.argmax())
        topic_probs = 1 / (1 + np.exp(-np.clip(vector @ self.topic_weights + self.topic_bias, -30, 30)))
        topics = [TOPICS[pos] for pos, prob in enumerate(topic_probs) if prob >= self.topic_threshold]
        centroid_scores = self.centroids @ vector
        clusters = [TOPICS[pos] for pos, score in enumerate(centroid_scores) if score >= 0.35]
        if not topics and clusters:
            topics = clusters
        return {
            "modelId": self.model_id,
            "documentType": DOCUMENT_TYPES[type_index],
            "topics": topics,
            "clusterTopics": clusters,
            "typeScores": {DOCUMENT_TYPES[pos]: float(type_probs[pos]) for pos in range(len(DOCUMENT_TYPES))},
        }

    def action_probability(self, sentence: str) -> float:
        vector = self._action_vector(sentence)
        score = float(vector @ self.action_weights + self.action_bias)
        return float(1 / (1 + math.exp(-max(-30, min(30, score)))))

    def priority(self, sentence: str) -> str:
        vector = self._action_vector(sentence)
        probs = _softmax((vector @ self.priority_weights + self.priority_bias).reshape(1, -1))[0]
        return ("low", "medium", "high")[int(probs.argmax())]


_MODEL: LocalModel | None = None


def get_model() -> LocalModel:
    global _MODEL
    if _MODEL is None:
        _MODEL = LocalModel()
    return _MODEL


def evaluate_held_out() -> dict:
    model = get_model()
    type_gold = [row["label"] for row in HELD_DOCUMENTS]
    type_pred = [model.classify(row["text"])["documentType"] for row in HELD_DOCUMENTS]
    topic_gold = []
    topic_pred = []
    cluster_pred = []
    for row in HELD_DOCUMENTS:
        result = model.classify(row["text"])
        for topic in TOPICS:
            topic_gold.append(1 if topic in row["topics"] else 0)
            topic_pred.append(1 if topic in result["topics"] else 0)
            cluster_pred.append(1 if topic in result["clusterTopics"] else 0)
    action_gold = np.array([row["label"] for row in HELD_ACTIONS])
    action_pred = np.array([1 if model.action_probability(row["text"]) >= 0.5 else 0 for row in HELD_ACTIONS])
    per_class = {}
    for label in DOCUMENT_TYPES:
        gold_bin = np.array([1 if item == label else 0 for item in type_gold])
        pred_bin = np.array([1 if item == label else 0 for item in type_pred])
        per_class[label] = _binary_scores(gold_bin, pred_bin)
    return {
        "modelId": model.model_id,
        "trainDocuments": len(TRAIN_DOCUMENTS),
        "heldDocuments": len(HELD_DOCUMENTS),
        "trainActions": len(TRAIN_ACTIONS),
        "heldActions": len(HELD_ACTIONS),
        "overlap": len({row["id"] for row in TRAIN_DOCUMENTS} & {row["id"] for row in HELD_DOCUMENTS})
        + len({row["id"] for row in TRAIN_ACTIONS} & {row["id"] for row in HELD_ACTIONS}),
        "documentType": {
            "accuracy": sum(left == right for left, right in zip(type_gold, type_pred)) / len(type_gold),
            "macroF1": _macro_f1(type_gold, type_pred, DOCUMENT_TYPES),
            "perClass": per_class,
            "predictions": list(zip((row["id"] for row in HELD_DOCUMENTS), type_gold, type_pred)),
        },
        "topics": _binary_scores(np.array(topic_gold), np.array(topic_pred)),
        "clusters": _binary_scores(np.array(topic_gold), np.array(cluster_pred)),
        "actions": _binary_scores(action_gold, action_pred),
        "topicThreshold": model.topic_threshold,
    }
