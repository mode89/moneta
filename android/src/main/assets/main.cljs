(require '[reagent.core :as r]
         '[reagent.dom :as rdom])

;; App state
(def app-state
  (r/atom {:expenses []
           :adding-entry? false
           :editing-entry? false
           :editing-entry-id nil}))

(def edited-entry
  (r/atom {:amount ""
           :description ""
           :date ""
           :categories ""}))

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
  (->> (.split categories-str " ")
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
(defn add-expense []
  (let [form @edited-entry
        error (validate-form form)]
    (if error
      (js/alert error)
      (let [expense {:id (.now js/Date)
                     :amount (js/parseFloat (:amount form))
                     :description (:description form)
                     :date (:date form)
                     :categories (parse-categories (:categories form))}
            expenses (:expenses @app-state)
            expenses* (conj expenses expense)]
        (save-expenses expenses*)
        (swap! app-state assoc
               :expenses expenses*
               :adding-entry? false)
        (reset! edited-entry {:amount ""
                              :description ""
                              :date (get-today-string)
                              :categories ""})))))

(defn update-expense []
  (let [form @edited-entry
        error (validate-form form)
        editing-id (:editing-entry-id @app-state)]
    (if error
      (js/alert error)
      (let [expense {:id editing-id
                     :amount (js/parseFloat (:amount form))
                     :description (:description form)
                     :date (:date form)
                     :categories (parse-categories (:categories form))}
            expenses (:expenses @app-state)
            expenses* (map #(if (= (:id %) editing-id) expense %) expenses)]
        (save-expenses expenses*)
        (swap! app-state assoc
               :expenses expenses*
               :editing-entry? false
               :editing-entry-id nil)
        (reset! edited-entry {:amount ""
                              :description ""
                              :date (get-today-string)
                              :categories ""})))))

(defn delete-expense [expense-id]
  (when (js/confirm "Are you sure you want to delete this expense?")
    (let [expenses (:expenses @app-state)
          expenses* (filter #(not= (:id %) expense-id) expenses)]
      (save-expenses expenses*)
      (swap! app-state assoc :expenses expenses*))))

(defn show-new-entry-modal []
  (swap! app-state assoc :adding-entry? true))

(defn hide-new-entry-modal []
  (swap! app-state assoc :adding-entry? false)
  (reset! edited-entry {:amount ""
                        :description ""
                        :date (get-today-string)
                        :categories ""}))

(defn show-edit-entry-modal [expense]
  (reset! edited-entry
          {:amount (str (:amount expense))
           :description (:description expense)
           :date (:date expense)
           :categories (clojure.string/join " " (:categories expense))})
  (swap! app-state assoc
         :editing-entry? true
         :editing-entry-id (:id expense)))

(defn hide-edit-entry-modal []
  (swap! app-state assoc
         :editing-entry? false
         :editing-entry-id nil)
  (reset! edited-entry {:amount ""
                        :description ""
                        :date (get-today-string)
                        :categories ""}))

(defn update-form [field value]
  (swap! edited-entry assoc field value))

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
    :on-click show-new-entry-modal}
   "+"])

(defn new-entry-modal []
  (let [form @edited-entry
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
          :on-click hide-new-entry-modal}]]
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
           "Categories"]
          [:input.form-control
           {:id "expenseCategories"
            :type "text"
            :placeholder "e.g. food shopping"
            :value (:categories form)
            :on-change #(update-form :categories
                          (-> % .-target .-value))}]]]]
       [:div.modal-footer
        [:button.btn.btn-secondary
         {:type "button"
          :on-click hide-new-entry-modal}
         "Cancel"]
        [:button.btn.btn-primary
         {:type "button"
          :on-click #(add-expense)}
         "Save"]]]]]))

(defn edit-entry-modal []
  (let [form @edited-entry
        show (:editing-entry? @app-state)
        editing-id (:editing-entry-id @app-state)]
    [:div
     {:class (str "modal fade" (when show " show"))
      :style {:display (if show "block" "none")
              :background-color "rgba(0,0,0,0.5)"}
      :tab-index "-1"}
     [:div.modal-dialog.modal-dialog-centered
      [:div.modal-content
       [:div.modal-header
        [:h5.modal-title "Edit Expense"]
        [:button.btn-close
         {:type "button"
          :on-click hide-edit-entry-modal}]]
       [:div.modal-body
        [:form
         [:div.mb-3
          [:label.form-label {:for "editExpenseAmount"} "Amount"]
          [:input.form-control
           {:id "editExpenseAmount"
            :type "number"
            :placeholder "0.00"
            :step "0.01"
            :value (:amount form)
            :on-change #(update-form :amount (-> % .-target .-value))}]]
         [:div.mb-3
          [:label.form-label {:for "editExpenseDescription"} "Description"]
          [:input.form-control
           {:id "editExpenseDescription"
            :type "text"
            :placeholder "e.g., Groceries, Dinner"
            :value (:description form)
            :on-change #(update-form :description
                          (-> % .-target .-value))}]]
         [:div.mb-3
          [:label.form-label {:for "editExpenseDate"} "Date"]
          [:input.form-control
           {:id "editExpenseDate"
            :type "date"
            :value (:date form)
            :on-change #(update-form :date (-> % .-target .-value))}]]
         [:div.mb-3
          [:label.form-label {:for "editExpenseCategories"}
           "Categories"]
          [:input.form-control
           {:id "editExpenseCategories"
            :type "text"
            :placeholder "e.g. food shopping"
            :value (:categories form)
            :on-change #(update-form :categories
                          (-> % .-target .-value))}]]]]
       [:div.modal-footer
        [:button.btn.btn-danger.me-auto
         {:type "button"
          :on-click #(do (delete-expense editing-id)
                         (hide-edit-entry-modal))}
         "Delete"]
        [:button.btn.btn-secondary
         {:type "button"
          :on-click hide-edit-entry-modal}
         "Cancel"]
        [:button.btn.btn-primary
         {:type "button"
          :on-click #(update-expense)}
         "Update"]]]]]))

(defn on-long-press [f]
  (let [timer (r/atom nil)]
    {:on-mouse-down (fn [e]
                      (.preventDefault e)
                      (reset! timer
                        (js/setTimeout f 500)))
     :on-mouse-up (fn [e]
                    (.preventDefault e)
                    (when @timer
                      (js/clearTimeout @timer)
                      (reset! timer nil)))
     :on-mouse-leave (fn [e]
                       (when @timer
                         (js/clearTimeout @timer)
                         (reset! timer nil)))
     :on-touch-start (fn [e]
                       (.preventDefault e)
                       (reset! timer
                         (js/setTimeout f 500)))
     :on-touch-end (fn [e]
                     (.preventDefault e)
                     (when @timer
                       (js/clearTimeout @timer)
                       (reset! timer nil)))
     :on-touch-cancel (fn [e]
                        (when @timer
                          (js/clearTimeout @timer)
                          (reset! timer nil)))}))

(defn expense-item [expense]
  (let [long-press-timer (r/atom nil)]
    (fn [expense]
      [:li.list-group-item
       (merge {:style {:cursor "pointer" :user-select "none"}}
              (on-long-press #(show-edit-entry-modal expense)))
       [:div.d-flex.justify-content-between
        [:div
         [:div.fw-bold (:description expense)]
         [:small.text-muted (:date expense)]
         (when (and (:categories expense) (seq (:categories expense)))
           [:div.text-info.small
            (clojure.string/join ", " (:categories expense))])]
        [:div.text-danger (str "-" (format-currency (:amount expense)))]]])))

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
   [new-entry-modal]
   [edit-entry-modal]])

(defn- main []
  (swap! app-state assoc
         :expenses (load-expenses))
  (reset! edited-entry {:amount ""
                        :description ""
                        :date (get-today-string)
                        :categories ""})
  (rdom/render [app] (.getElementById js/document "app")))

(main)
