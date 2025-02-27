import pandas as pd
import numpy as np
import json
import os
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from sklearn.preprocessing import MinMaxScaler

# Configuration
DATASET_PATH = "apple_sales_2024.csv"
RESULTS_PATH = "public/data/all_results.json"
SEQ_LENGTH = 10  # 10 days for prediction
TRAIN_RATIO = 0.8  # 80% training data

# Ensure results directory exists
os.makedirs(os.path.dirname(RESULTS_PATH), exist_ok=True)

# Load dataset
df = pd.read_csv(DATASET_PATH)
df["init_time"] = pd.to_datetime(df["init_time"])
df.set_index("init_time", inplace=True)

# Define product columns (excluding prices and discounts)
PRODUCT_COLUMNS = [col for col in df.columns if "Stock" in col]

# Store results
results = {}

def create_sequences(data, seq_length):
    """Generate sequences for LSTM."""
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i:i+seq_length])
        y.append(data[i+seq_length])
    return np.array(X), np.array(y)

def build_lstm_model(input_shape):
    """Create LSTM model."""
    model = Sequential([
        LSTM(64, activation="relu", return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(32, activation="relu"),
        Dense(1)
    ])
    model.compile(optimizer=Adam(learning_rate=0.001), loss="mse")
    return model

for product in PRODUCT_COLUMNS:
    print(f"\n📊 Training model for {product}...")

    # Scale data
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(df[[product]])

    # Create sequences
    X, y = create_sequences(scaled_data, SEQ_LENGTH)
    train_size = int(len(X) * TRAIN_RATIO)

    X_train, X_test = X[:train_size], X[train_size:]
    y_train, y_test = y[:train_size], y[train_size:]

    # Train LSTM model
    model = build_lstm_model((SEQ_LENGTH, 1))
    model.fit(X_train, y_train, epochs=50, batch_size=16, verbose=1)

    # Make predictions
    y_pred = model.predict(X_test)

    # Inverse transform predictions
    y_test_inv = scaler.inverse_transform(y_test)
    y_pred_inv = scaler.inverse_transform(y_pred)

    # Convert data to lists
    y_test_list = y_test_inv.flatten().tolist()
    y_pred_list = [round(num, 2) for num in y_pred_inv.flatten().tolist()]
    dates = df.index[-len(y_test):].strftime("%Y-%m-%d").tolist()

    # Anomaly detection (spikes or drops)
    threshold = 1.5 * np.std(np.array(y_test_list) - np.array(y_pred_list))
    anomalies = [dates[i] for i in range(len(y_test_list)) if abs(y_test_list[i] - y_pred_list[i]) > threshold]

    # Store results
    results[product] = {
        "dates": dates,
        "actual_sales": y_test_list,
        "predicted_sales": y_pred_list,
        "anomalies": anomalies
    }

# Save to JSON
with open(RESULTS_PATH, "w") as json_file:
    json.dump(results, json_file, indent=4)

print(f"\n✅ Predictions saved to {RESULTS_PATH}")
