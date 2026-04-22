import pandas as pd
from sklearn.ensemble import RandomForestClassifier

suppliers = pd.read_csv("data/suppliers_v2.csv")
transactions = pd.read_csv("data/transactions_v2.csv").rename(
    columns={"delay_days": "delivery_delay_days"}
)
esg_environmental = pd.read_csv("data/esg_environmental_v2.csv")
esg_social = pd.read_csv("data/esg_social_v2.csv")
esg = esg_environmental.merge(esg_social, on="supplier_id", how="inner")

performance = transactions.groupby("supplier_id").mean().reset_index()

data = performance.merge(esg,on="supplier_id")

data["risk"] = (
(data["delivery_delay_days"] > 10) |
(data["defect_rate"] > 0.1) |
(data["labor"] > 0.5)
).astype(int)

X = data[
[
"delivery_delay_days",
"defect_rate",
"cost_variance",
"carbon",
"water",
"labor"
]
]

y = data["risk"]

model = RandomForestClassifier()

model.fit(X,y)

def predict_supplier_risk(values):

    prediction = model.predict([values])

    return int(prediction[0])
