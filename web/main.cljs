(ns main
  (:require
    [clojure.string :as string]
    [reagent.core :as r]
    [reagent.dom :as rdom]))

(declare
  summary-card
  expense-list
  expense-item
  new-expense-button
  new-expense-modal
  edit-expense-modal
  export-expenses
  import-expenses
  import-expenses-from
  json-expenses
  parse-json-expenses
  load-expenses
  save-expenses
  format-currency
  format-date
  now
  js-date
  beginning-of-day
  find-first
  update-match)

(def app-state
  (r/atom
    {:expenses []
     :adding-expense? false
     :editing-expense nil
     :show-numbers? false
     :bubble nil}))

(defn app []
  [:div.container.mt-4
   [summary-card]
   [expense-list]
   [new-expense-button]
   (when (:adding-expense? @app-state)
     [new-expense-modal])
   (when (:editing-expense @app-state)
     [edit-expense-modal (:editing-expense @app-state)])
   (when-let [message (:bubble @app-state)]
     [:div.bubble.alert.alert-success.show
      {:role "alert"}
      message])])

(defn summary-card []
  [:div.card.mb-4
   [:div.card-body
    [:h2.card-title
     (.toLocaleString (now) "default" #js{:month "long"})]
    [:p.card-text.fs-3
     {:on-click #(swap! app-state update :show-numbers? not)
      :style {:cursor "pointer"}}
     "Total Spent: "
     [:span {:style {:color "#dc3545"}}
      (let [year (.getFullYear (now))
            month (.getMonth (now))
            total (->> @app-state
                       :expenses
                       (filter #(and (= year (.getFullYear (:date %)))
                                     (= month (.getMonth (:date %)))))
                       (map :amount)
                       (reduce + 0))]
        (if (:show-numbers? @app-state)
          (format-currency total)
          [:span.blur-text (format-currency total)]))]]]])

(defn expense-list []
  [:div.card.mt-4.custom-mb-100
   [:div.card-header.d-flex.justify-content-between.align-items-center
    [:h3.mb-0 "Expenses"]
    [:div
     [:button.btn.btn-outline-secondary.btn-sm
      {:on-click import-expenses
       :title "Import Expenses"}
      [:img {:src "file_download.svg"
             :alt "Import"
             :style {:width "24px" :height "24px"}}]]
     [:button.btn.btn-outline-secondary.btn-sm.ms-2
      {:on-click export-expenses
       :title "Export Expenses"}
      [:img {:src "file_upload.svg"
             :alt "Export"
             :style {:width "24px" :height "24px"}}]]]]
   [:ul.list-group.list-group-flush
    (if (empty? (:expenses @app-state))
      [:li.list-group-item.text-muted.text-center "No expenses yet"]
      (map #(vector expense-item %)
           (sort-by :date > (:expenses @app-state))))]])

(defn expense-item [expense]
  [:li.list-group-item.d-flex.justify-content-between.align-items-center
   {:style {:cursor "pointer" :user-select "none"}
    :on-click #(swap! app-state assoc :editing-expense (:id expense))}
   [:div
    [:strong (:description expense)]
    [:br]
    [:small.text-muted (format-date (:date expense))]
    (when (seq (:categories expense))
      [:div.text-info.small
       (string/join ", " (sort (:categories expense)))])]
   [:span.text-danger
    {:on-click (fn [e]
                 (.stopPropagation e)
                 (swap! app-state update :show-numbers? not))}
    (let [amount (str "-" (format-currency (:amount expense)))]
      (if (:show-numbers? @app-state)
        amount
        [:span.blur-text amount]))]])

(defn new-expense-button []
  [:button.btn.btn-primary.btn-lg.rounded-circle.fixed-bottom-right
   {:style {:z-index 1000}
    :on-click #(swap! app-state assoc :adding-expense? true)}
   "+"])

(declare
  new-expense-modal-hide
  new-expense-validate
  new-expense-save)

(defn new-expense-modal* [expense]
  [:div.modal.fade.show
   {:style {:display "block" :background-color "rgba(0,0,0,0.5)"}
    :tab-index "-1"}
   [:div.modal-dialog.modal-dialog-centered
    [:div.modal-content
     [:div.modal-header
      [:h5.modal-title "New Expense"]
      [:button.btn-close
       {:type "button"
        :on-click new-expense-modal-hide}]]
     [:div.modal-body
      [:form
       [:div.mb-3
        [:label.form-label {:html-for "expense-amount"} "Amount"]
        [:input.form-control
         {:id "expense-amount"
          :type "number"
          :placeholder "0.00"
          :step "0.01"
          :value (:amount @expense)
          :on-change #(swap! expense assoc :amount
                             (-> % .-target .-value))}]]
       [:div.mb-3
        [:label.form-label
         {:html-for "expense-description"}
         "Description"]
        [:input.form-control
         {:id "expense-description"
          :type "text"
          :placeholder "e.g., Groceries, Dinner"
          :value (:description @expense)
          :on-change #(swap! expense assoc :description
                             (-> % .-target .-value))}]]
       [:div.mb-3
        [:label.form-label {:html-for "expense-date"} "Date"]
        [:input.form-control
         {:id "expense-date"
          :type "date"
          :value (format-date (:date @expense))
          :on-change #(swap! expense assoc :date
                             (-> % .-target .-value js-date))}]]
       [:div.mb-3
        [:label.form-label
         {:html-for "expense-categories"}
         "Categories"]
        [:input.form-control
         {:id "expense-categories"
          :type "text"
          :placeholder "e.g. food shopping"
          :value (:categories @expense)
          :on-change #(swap! expense assoc :categories
                             (-> % .-target .-value))}]]]]
     [:div.modal-footer
      [:button.btn.btn-secondary
       {:type "button"
        :on-click new-expense-modal-hide}
       "Cancel"]
      [:button.btn.btn-primary
       {:type "button"
        :on-click #(if-let [error (new-expense-validate @expense)]
                    (js/alert error)
                    (do (new-expense-save @expense)
                        (new-expense-modal-hide)))}
       "Save"]]]]])

(defn new-expense-modal []
  (let [expense (r/atom {:amount ""
                         :description ""
                         :date (now)
                         :categories ""})]
    #(new-expense-modal* expense)))

(defn new-expense-validate [expense]
  (let [amount (-> expense :amount js/parseFloat)
        description (-> expense :description string/trim)
        date (-> expense :date beginning-of-day)]
    (cond
      (or (js/isNaN amount) (<= amount 0))
      "Invalid amount."

      (string/blank? description)
      "Description cannot be empty."

      (not (instance? js/Date date))
      "Invalid date."

      (> (.getTime date) (.getTime (now)))
      "Date cannot be in the future.")))

(defn new-expense-save [expense]
  (swap! app-state update :expenses conj
    {:id (.getTime (now))
     :amount (-> expense :amount js/parseFloat)
     :description (-> expense :description string/trim)
     :date (-> expense :date js-date)
     :categories (as-> expense $
                   (:categories $)
                   (string/trim $)
                   (string/split $ #"\s+")
                   (map string/lower-case $)
                   (sort $))})
  (save-expenses))

(defn new-expense-modal-hide []
  (swap! app-state assoc :adding-expense? false))

(declare
  edit-expense-modal-hide
  new-expense-validate
  edit-expense-save)

(defn edit-expense-modal* [expense]
  [:div.modal.fade.show
   {:style {:display "block" :background-color "rgba(0,0,0,0.5)"}
    :tab-index "-1"}
   [:div.modal-dialog.modal-dialog-centered
    [:div.modal-content
     [:div.modal-header
      [:h5.modal-title "Edit Expense"]
      [:button.btn-close
       {:type "button"
        :on-click edit-expense-modal-hide}]]
     [:div.modal-body
      [:form
       [:div.mb-3
        [:label.form-label {:html-for "expense-amount"} "Amount"]
        [:input.form-control
         {:id "expense-amount"
          :type "number"
          :placeholder "0.00"
          :step "0.01"
          :value (:amount @expense)
          :on-change #(swap! expense assoc :amount
                             (-> % .-target .-value))}]]
       [:div.mb-3
        [:label.form-label
         {:html-for "expense-description"}
         "Description"]
        [:input.form-control
         {:id "expense-description"
          :type "text"
          :placeholder "e.g., Groceries, Dinner"
          :value (:description @expense)
          :on-change #(swap! expense assoc :description
                             (-> % .-target .-value))}]]
       [:div.mb-3
        [:label.form-label {:html-for "expense-date"} "Date"]
        [:input.form-control
         {:id "expense-date"
          :type "date"
          :value (format-date (:date @expense))
          :on-change #(swap! expense assoc :date
                             (-> % .-target .-value js-date))}]]
       [:div.mb-3
        [:label.form-label
         {:html-for "expense-categories"}
         "Categories"]
        [:input.form-control
         {:id "expense-categories"
          :type "text"
          :placeholder "e.g. food shopping"
          :value (:categories @expense)
          :on-change #(swap! expense assoc :categories
                             (-> % .-target .-value))}]]]]
     [:div.modal-footer
      [:button.btn.btn-danger.me-auto
       {:type "button"
        :on-click (fn []
                    (when (js/confirm "Are you sure?")
                      (swap! app-state update :expenses
                        (fn [expenses]
                          (remove #(= (:id @expense) (:id %)) expenses)))
                      (save-expenses)
                      (edit-expense-modal-hide)))}
       "Delete"]
      [:button.btn.btn-secondary
       {:type "button"
        :on-click edit-expense-modal-hide}
       "Cancel"]
      [:button.btn.btn-primary
       {:type "button"
        :on-click #(if-let [error (new-expense-validate @expense)]
                     (js/alert error)
                     (edit-expense-save @expense))}
       "Update"]]]]])

(defn edit-expense-modal [expense-id]
  (let [expense (r/atom (as-> @app-state $
                          (:expenses $)
                          (find-first #(= expense-id (:id %)) $)
                          (update $ :amount str)
                          (update $ :categories #(string/join " " %))))]
    #(vector edit-expense-modal* expense)))

(defn edit-expense-modal-hide []
  (swap! app-state assoc :editing-expense nil))

(defn edit-expense-save [expense]
  (swap! app-state update :expenses update-match
    #(= (:id %) (:id expense))
    #(hash-map
      :id (:id expense)
      :amount (-> expense :amount js/parseFloat)
      :description (-> expense :description string/trim)
      :date (-> expense :date js-date)
      :categories (as-> expense $
                    (:categories $)
                    (string/trim $)
                    (string/split $ #"\s+")
                    (map string/lower-case $)
                    (sort $))))
  (save-expenses)
  (edit-expense-modal-hide))

(defn export-expenses []
  (let [expenses (:expenses @app-state)
        json (json-expenses expenses)
        filename (str "moneta-" (format-date (now)) ".json")]
    (if (some? js/Android)
      (js/Android.createFile filename json)
      (let [blob (js/Blob. #js[json] #js{:type "application/json"})
            url (js/URL.createObjectURL blob)
            link (js/document.createElement "a")]
        (set! (.-href link) url)
        (set! (.-download link) filename)
        (.appendChild js/document.body link)
        (.click link)
        (.removeChild js/document.body link)
        (js/URL.revokeObjectURL url)))))

(defn import-expenses []
  (println "Importing expenses ...")
  (if (some? js/Android)
    (do
      (println "Importing expenses via Android.pickFile")
      (js/Android.pickFile import-expenses-from))
    (do
      (println "Importing expenses via file input (not Android)")
      (let [input (js/document.createElement "input")]
        (set! (.-type input) "file")
        (set! (.-accept input) ".json")
        (set! (.-onchange input)
          (fn [e]
            (let [file (aget (.-files (.-target e)) 0)
                  reader (js/FileReader.)]
              (when file
                (set! (.-onload reader)
                  #(import-expenses-from (.-result (.-target %))))
                (.readAsText reader file)))))
        (.click input)))))

(defn import-expenses-from [content]
  (try
    (println "Parsing imported expenses JSON")
    (let [imported (parse-json-expenses content)
          errors (->> imported
                      (map
                        #(cond
                          (nil? (:id %))
                          "Missing ID."

                          (or (js/isNaN (:amount %) (<= (:amount %) 0)))
                          "Invalid amount."

                          (string/blank? (:description %))
                          "Empty description."

                          (> (.getTime (:date %)) (.getTime (now)))
                          "Date cannot be in the future."))
                      (filter some?))]
      (if (seq errors)
        (do
          (js/alert "File contains errors.")
          (doseq [error errors]
            (js/console.error error)))
        (do
          (swap! app-state assoc :expenses imported)
          (save-expenses))))
    (catch js/Error e
      (js/alert (str "Failed to import expenses: " (.-message e))))))

(defn validate-expense [expense]
  (let [amount (-> expense :amount js/parseFloat)
        description (-> expense :description string/trim)
        date (-> expense :date beginning-of-day)]
    (cond
      (or (js/isNaN amount) (<= amount 0))
      "Invalid amount."

      (string/blank? description)
      "Description cannot be empty."

      (not (instance? js/Date date))
      "Invalid date."

      (> (.getTime date) (.getTime (now)))
      "Date cannot be in the future.")))

(defn json-expenses [expenses]
  (as-> expenses $
    (map #(update % :date format-date) $)
    (clj->js $)
    (js/JSON.stringify $ nil 2)))

(defn load-expenses []
  (if-let [stored (js/localStorage.getItem "expenses")]
    (parse-json-expenses stored)
    []))

(defn save-expenses []
  (->> @app-state
       :expenses
       json-expenses
       (js/localStorage.setItem "expenses"))
  (println "Expenses saved to local storage.")
  (swap! app-state assoc :bubble "Saved")
  (js/setTimeout
    #(swap! app-state assoc :bubble nil)
    3000))

(defn parse-json-expenses [json]
  (as-> json $
    (js/JSON.parse $)
    (js->clj $ :keywordize-keys true)
    (map #(update % :date js-date) $)))

(defn format-date [date]
  (let [year (.getFullYear date)
        month (-> date .getMonth inc str (.padStart 2 "0"))
        day (-> date .getDate str (.padStart 2 "0"))]
    (str year "-" month "-" day)))

(defn format-currency [amount]
  (str "$" (.toFixed amount 2)))

(defn beginning-of-day [date]
  (doto (js-date date)
    (.setHours 0 0 0 0)))

(defn now []
  (js/Date.))

(defn js-date [date]
  (js/Date. date))

(defn find-first [pred coll]
  (first (filter pred coll)))

(defn update-match [coll pred f & args]
  (map (fn [x]
         (if (pred x)
           (apply f x args)
           x))
       coll))

(swap! app-state assoc :expenses (load-expenses))
(rdom/render [app] js/document.body)
