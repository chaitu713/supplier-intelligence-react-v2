import pandas as pd
from sklearn.ensemble import RandomForestClassifier

suppliers = pd.read_csv("data/suppliers.csv")
transactions = pd.read_csv("data/transactions.csv")
esg = pd.read_csv("data/esg_metrics.csv")

performance = transactions.groupby("supplier_id").mean().reset_index()

data = performance.merge(esg,on="supplier_id")

data["risk"] = (
(data["delivery_delay_days"] > 10) |
(data["defect_rate"] > 0.1) |
(data["labor_violations"] > 2)
).astype(int)

X = data[
[
"delivery_delay_days",
"defect_rate",
"cost_variance",
"carbon_emission",
"water_usage",
"labor_violations"
]
]

y = data["risk"]

model = RandomForestClassifier()

model.fit(X,y)

def predict_supplier_risk(values):

    prediction = model.predict([values])

    return int(prediction[0])