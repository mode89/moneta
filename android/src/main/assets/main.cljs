(require '[reagent.core :as r]
         '[reagent.dom :as rdom])

;; App state
(def app-state
  (r/atom {:expenses []
           :adding-entry? false
           :form {:amount ""
                  :description ""
                  :date ""
                  :categories ""}}))

;; Utility functions
(defn load-expenses []
  (let [stored (.getItem js/localStorage "expenses")]
    (if stored
      (js->clj (.parse js/JSON stored) :keywordize-keys true)
      [])))

(defn save-expenses [expenses]
  (.setItem js/localStorage "expenses"
    (.stringify js/JSON (clj->js expenses))))

(defn calculate-total [expenses]
  (reduce (fn [total expense] (+ total (:amount expense))) 0 expenses))

(defn format-currency [amount]
  (str "$" (.toFixed amount 2)))

(defn get-current-month []
  (let [now (js/Date.)]
    (.toLocaleString now "default" #js {:month "long" :year "numeric"})))

(defn get-today-string []
  (let [today (js/Date.)
        year (.getFullYear today)
        month (.padStart (str (inc (.getMonth today))) 2 "0")
        day (.padStart (str (.getDate today)) 2 "0")]
    (str year "-" month "-" day)))

(defn- beginning-of-day [^js/Date date]
  (js/Date. (.getFullYear date) (.getMonth date) (.getDate date)))

(defn parse-categories [categories-str]
  (->> (.split categories-str ",")
       (map #(.trim %))
       (filter #(not= % ""))))

(defn validate-form [form]
  (let [amount (js/parseFloat (:amount form))
        description (.trim (:description form))
        date (:date form)]
    (cond
      (or (js/isNaN amount) (<= amount 0))
      "Please enter a valid amount."

      (= description "")
      "Please enter a description."

      (= date "")
      "Please select a date."

      (> (beginning-of-day (js/Date. date)) (beginning-of-day (js/Date.)))
      "Date cannot be in the future."

      :else nil)))

;; Event handlers
(defn add-expense [form]
  (let [error (validate-form form)]
    (if error
      (js/alert error)
      (let [categories (parse-categories (:categories form))
            new-expense {:id (.now js/Date)
                         :amount (js/parseFloat (:amount form))
                         :description (:description form)
                         :date (:date form)
                         :categories categories}
            current-expenses (:expenses @app-state)
            updated-expenses (conj current-expenses new-expense)]
        (save-expenses updated-expenses)
        (swap! app-state assoc
               :expenses updated-expenses
               :adding-entry? false
               :form {:amount ""
                      :description ""
                      :date (get-today-string)
                      :categories ""})))))

(defn show-modal []
  (swap! app-state assoc :adding-entry? true))

(defn hide-modal []
  (swap! app-state assoc
         :adding-entry? false
         :form {:amount ""
                :description ""
                :date (get-today-string)
                :categories ""}))

(defn update-form [field value]
  (swap! app-state assoc-in [:form field] value))

;; Components
(defn summary-card []
  (let [expenses (:expenses @app-state)
        total (calculate-total expenses)]
    [:div.card.mb-4
     [:div.card-body
      [:h2.card-title (get-current-month)]
      [:p.card-text.fs-3 "Total Spent: "
       [:span {:style {:color "#dc3545"}} (format-currency total)]]]]))

(defn add-button []
  [:button.btn.btn-primary.btn-lg.rounded-circle.fixed-bottom-right
   {:style {:z-index "1000"}
    :on-click show-modal}
   "+"])

(defn expense-modal []
  (let [form (:form @app-state)
        show (:adding-entry? @app-state)]
    [:div
     {:class (str "modal fade" (when show " show"))
      :style {:display (if show "block" "none")
              :background-color "rgba(0,0,0,0.5)"}
      :tab-index "-1"}
     [:div.modal-dialog.modal-dialog-centered
      [:div.modal-content
       [:div.modal-header
        [:h5.modal-title "New Expense"]
        [:button.btn-close
         {:type "button"
          :on-click hide-modal}]]
       [:div.modal-body
        [:form
         [:div.mb-3
          [:label.form-label {:for "expenseAmount"} "Amount"]
          [:input.form-control
           {:id "expenseAmount"
            :type "number"
            :placeholder "0.00"
            :step "0.01"
            :value (:amount form)
            :on-change #(update-form :amount (-> % .-target .-value))}]]
         [:div.mb-3
          [:label.form-label {:for "expenseDescription"} "Description"]
          [:input.form-control
           {:id "expenseDescription"
            :type "text"
            :placeholder "e.g., Groceries, Dinner"
            :value (:description form)
            :on-change #(update-form :description
                          (-> % .-target .-value))}]]
         [:div.mb-3
          [:label.form-label {:for "expenseDate"} "Date"]
          [:input.form-control
           {:id "expenseDate"
            :type "date"
            :value (:date form)
            :on-change #(update-form :date (-> % .-target .-value))}]]
         [:div.mb-3
          [:label.form-label {:for "expenseCategories"}
           "Categories (comma-separated)"]
          [:input.form-control
           {:id "expenseCategories"
            :type "text"
            :placeholder "e.g., Food, Shopping"
            :value (:categories form)
            :on-change #(update-form :categories
                          (-> % .-target .-value))}]]]]
       [:div.modal-footer
        [:button.btn.btn-secondary
         {:type "button"
          :on-click hide-modal}
         "Cancel"]
        [:button.btn.btn-primary
         {:type "button"
          :on-click #(add-expense form)}
         "Save"]]]]]))

(defn expense-item [expense]
  [:li.list-group-item
   [:div.d-flex.justify-content-between
    [:div
     [:div.fw-bold (:description expense)]
     [:small.text-muted (:date expense)]
     (when (and (:categories expense) (seq (:categories expense)))
       [:div.text-info.small "Categories: "
        (clojure.string/join ", " (:categories expense))])]
    [:div.text-danger (str "-" (format-currency (:amount expense)))]]])

(defn expense-list []
  (let [expenses (->> (:expenses @app-state)
                      (sort-by :date)
                      reverse)]
    [:div.card.mt-4.custom-mb-100
     [:div.card-header
      [:h3.mb-0 "Expenses"]]
     [:ul.list-group.list-group-flush
      (if (empty? expenses)
        [:li.list-group-item.text-muted.text-center "No expenses yet"]
        (for [expense expenses]
          ^{:key (:id expense)}
          [expense-item expense]))]]))

(defn app []
  [:div.container.mt-4
   [summary-card]
   [expense-list]
   [add-button]
   [expense-modal]])

(defn- main []
  (swap! app-state assoc
         :expenses (load-expenses)
         :form {:amount ""
                :description ""
                :date (get-today-string)
                :categories ""})
  (rdom/render [app] (.getElementById js/document "app")))

(main)
