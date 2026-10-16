defmodule Grange.Mailer.Mailjet do
  @moduledoc """
  Sends through Mailjet's REST API over `:httpc`, so no SMTP dependency is
  needed. Mailjet offers a free low-volume tier, which is why it is the default
  production provider.
  """

  @behaviour Grange.Mailer

  @endpoint ~c"https://api.mailjet.com/v3.1/send"

  @impl Grange.Mailer
  def deliver(%{to: to, subject: subject, text: text}) do
    {key, secret, from, name} = credentials()

    body =
      Jason.encode!(%{
        Messages: [
          %{
            From: %{Email: from, Name: name},
            To: [%{Email: to}],
            Subject: subject,
            TextPart: text
          }
        ]
      })

    headers = [
      {~c"authorization", ~c"Basic " ++ Base.encode64("#{key}:#{secret}")},
      {~c"content-type", ~c"application/json"}
    ]

    request = {@endpoint, headers, ~c"application/json", body}

    case :httpc.request(:post, request, [], []) do
      {:ok, {{_, status, _}, _headers, _body}} when status in 200..299 ->
        :ok

      {:ok, {{_, status, _}, _headers, resp}} ->
        {:error, "Mailjet send failed: #{status} #{resp}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp credentials do
    key = System.get_env("MAILJET_API_KEY") || ""
    secret = System.get_env("MAILJET_API_SECRET") || ""
    from = System.get_env("MAIL_FROM_EMAIL") || ""
    name = System.get_env("MAIL_FROM_NAME") || "Grange"
    {key, secret, from, name}
  end
end
