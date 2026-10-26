defmodule Grange.Mailer.Mailjet do
  @moduledoc """
  Sends through Mailjet's REST API over `:httpc`, so no SMTP dependency is
  needed. Mailjet offers a free low-volume tier, which is why it is the default
  production provider.

  Requires the `:inets` and `:ssl` applications (started via `extra_applications`)
  plus the `MAILJET_API_KEY`, `MAILJET_API_SECRET`, and `MAIL_FROM_EMAIL`
  environment variables. A missing configuration is reported as an error rather
  than crashing the caller, so registration can still succeed.
  """

  @behaviour Grange.Mailer

  @endpoint ~c"https://api.mailjet.com/v3.1/send"
  @timeout 10_000

  @impl Grange.Mailer
  def deliver(%{to: to, subject: subject, text: text}) do
    case credentials() do
      {:ok, key, secret, from, name} -> send(key, secret, from, name, to, subject, text)
      {:error, reason} -> {:error, reason}
    end
  rescue
    # The mail adapter is a best-effort seam: a transport-level crash must not
    # take down registration or a password-reset request.
    error -> {:error, Exception.message(error)}
  end

  defp send(key, secret, from, name, to, subject, text) do
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
      {~c"authorization", String.to_charlist("Basic " <> Base.encode64("#{key}:#{secret}"))},
      {~c"content-type", ~c"application/json"}
    ]

    request = {@endpoint, headers, ~c"application/json", body}

    case :httpc.request(:post, request, http_options(), []) do
      {:ok, {{_, status, _}, _headers, _body}} when status in 200..299 ->
        :ok

      {:ok, {{_, status, _}, _headers, resp}} ->
        {:error, "Mailjet send failed: #{status} #{resp}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp http_options do
    [
      timeout: @timeout,
      connect_timeout: @timeout,
      ssl: [
        verify: :verify_peer,
        cacerts: :public_key.cacerts_get(),
        depth: 3,
        customize_hostname_check: [
          match_fun: :public_key.pkix_verify_hostname_match_fun(:https)
        ]
      ]
    ]
  end

  defp credentials do
    key = System.get_env("MAILJET_API_KEY") || ""
    secret = System.get_env("MAILJET_API_SECRET") || ""
    from = System.get_env("MAIL_FROM_EMAIL") || ""
    name = System.get_env("MAIL_FROM_NAME") || "Grange"

    if key == "" or secret == "" or from == "" do
      {:error,
       "Mailjet is not configured (set MAILJET_API_KEY, MAILJET_API_SECRET, MAIL_FROM_EMAIL)"}
    else
      {:ok, key, secret, from, name}
    end
  end
end
